from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import numpy as np
from PIL import Image, ImageOps


TRANSACTION_ID_PATTERNS = [
    re.compile(
        r"(?:transaction|txn|trx|trans|reference|ref|invoice|receipt|document|order|payment)"
        r"\s*(?:id|no|number|#)\s*[:.\-]?\s*([a-z0-9][a-z0-9\-]{3,31})",
        re.IGNORECASE,
    ),
    re.compile(r"\b([a-z]{2,10}[0-9]{4,20}|[0-9]{8,20})\b", re.IGNORECASE),
]
AMOUNT_PATTERNS = [
    re.compile(
        r"(?:amount|total|paid|payment)\s*[:.\-]?\s*(?:pkr|rs\.?|aed|usd)?\s*([0-9][0-9, ]*(?:\.[0-9]{2})?)",
        re.IGNORECASE,
    ),
    re.compile(r"(?:pkr|rs\.?|aed|usd)\s*([0-9][0-9, ]*(?:\.[0-9]{2})?)", re.IGNORECASE),
]
TEXT_NORMALIZATIONS = (
    (re.compile(r"(?i)trans\s*action"), "Transaction"),
    (re.compile(r"(?i)re\s*ference"), "Reference"),
    (re.compile(r"(?i)am\s*ount"), "Amount"),
    (re.compile(r"(?i)se\s*nder"), "Sender"),
    (re.compile(r"(?i)re\s*ceiver"), "Receiver"),
    (re.compile(r"(?i)pay\s*ment"), "Payment"),
    (re.compile(r"(?i)in\s*voice"), "Invoice"),
)
DATE_PATTERNS = [
    re.compile(r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b"),
    re.compile(r"\b(\d{2}[-/]\d{2}[-/]\d{4})\b"),
    re.compile(r"\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b"),
]
TIME_PATTERN = re.compile(r"\b(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?)\b", re.IGNORECASE)
PARTY_PATTERNS = {
    "sender": [
        re.compile(r"(?:sender\s*name|sender|from|paid\s*by|payer\s*name|payer|customer\s*name|customer|account\s*holder)\s*[:.\-]\s*(.+)", re.IGNORECASE),
    ],
    "receiver": [
        re.compile(r"(?:receiver\s*name|receiver|to|paid\s*to|payee\s*name|payee|merchant\s*name|merchant|beneficiary\s*name|beneficiary)\s*[:.\-]\s*(.+)", re.IGNORECASE),
    ],
}

_rapidocr_engine: Any | None = None
OCR_CACHE_VERSION = b"transactioniq-ocr-v2:"


@dataclass
class OcrExtraction:
    file_hash: str
    transaction_id: str
    date: str
    time: str
    amount: str
    sender: str
    receiver: str
    source: str


def current_date() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def current_time() -> str:
    return datetime.utcnow().strftime("%I:%M %p")


def process_receipt(file_bytes: bytes, file_name: str, channel: str) -> OcrExtraction:
    del channel
    file_hash = hashlib.sha256(OCR_CACHE_VERSION + file_bytes).hexdigest()
    text, source = extract_text(file_bytes)
    text = normalize_ocr_text(text)

    # 1. Try template-based parsing first
    template_fields = try_parse_template(text)

    # 2. Extract with fallback to generic parsers if template didn't find them
    transaction_id = template_fields.get("transaction_id") or parse_transaction_id(text)
    amount = template_fields.get("amount") or parse_amount(text)
    date = template_fields.get("date") or parse_date(text)
    time = template_fields.get("time") or parse_time(text)
    sender = template_fields.get("sender") or parse_party(text, "sender")
    receiver = template_fields.get("receiver") or parse_party(text, "receiver")

    if not transaction_id and not text.strip():
        transaction_id = fallback_transaction_id(file_hash)

    if not date:
        date = current_date()
    if not time:
        time = current_time()

    return OcrExtraction(
        file_hash=file_hash,
        transaction_id=transaction_id,
        date=date,
        time=time,
        amount=amount,
        sender=sender,
        receiver=receiver,
        source=source,
    )


def extract_text(file_bytes: bytes) -> tuple[str, str]:
    text = extract_text_with_ocr_space(file_bytes)
    if text:
        return text, "ocr-space"

    text = extract_text_with_rapidocr(file_bytes)
    if text:
        return text, "rapidocr"
    return "", "hash-fallback"


def extract_text_with_ocr_space(file_bytes: bytes) -> str:
    from .config import get_config
    config = get_config()
    api_key = config.ocr_space_api_key
    if not api_key:
        return ""

    import json
    import urllib.request
    import uuid

    boundary = f"Boundary-{uuid.uuid4().hex}"
    body = bytearray()

    # apikey field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="apikey"\r\n\r\n')
    body.extend(f"{api_key}\r\n".encode())

    # language field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="language"\r\n\r\n')
    body.extend(b"eng\r\n")

    # isOverlayRequired field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="isOverlayRequired"\r\n\r\n')
    body.extend(b"false\r\n")

    # file field
    body.extend(f"--{boundary}\r\n".encode())
    body.extend(b'Content-Disposition: form-data; name="file"; filename="receipt.jpg"\r\n')
    body.extend(b"Content-Type: image/jpeg\r\n\r\n")
    body.extend(file_bytes)
    body.extend(b"\r\n")

    # end boundary
    body.extend(f"--{boundary}--\r\n".encode())

    url = "https://api.ocr.space/parse/image"
    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            res_bytes = response.read()
            data = json.loads(res_bytes.decode("utf-8"))
            parsed_results = data.get("ParsedResults")
            if parsed_results and len(parsed_results) > 0:
                parsed_text = parsed_results[0].get("ParsedText")
                if isinstance(parsed_text, str):
                    return parsed_text
    except Exception as e:
        import sys
        print(f"OCR.space API request failed: {e}", file=sys.stderr)

    return ""


def extract_text_with_rapidocr(file_bytes: bytes) -> str:
    global _rapidocr_engine

    try:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore
    except ImportError:
        return ""

    if _rapidocr_engine is None:
        _rapidocr_engine = RapidOCR()

    try:
        image = Image.open(io.BytesIO(file_bytes))
        image = ImageOps.exif_transpose(image).convert("RGB")
        result, _elapsed = _rapidocr_engine(np.array(image))
    except Exception:
        return ""

    if not result:
        return ""

    lines: list[str] = []
    for item in result:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            raw_text = item[1]
            if isinstance(raw_text, str):
                cleaned = sanitize_text(raw_text)
                if cleaned:
                    lines.append(cleaned)
    return "\n".join(lines)
def sanitize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_ocr_text(text: str) -> str:
    normalized = text
    for pattern, replacement in TEXT_NORMALIZATIONS:
        normalized = pattern.sub(replacement, normalized)
    return normalized


def parse_transaction_id(text: str) -> str:
    if not text:
        return ""

    for pattern in TRANSACTION_ID_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        compact = re.sub(r"[^a-zA-Z0-9]", "", match.group(1)).upper()
        if len(compact) >= 4:
            return compact
    return ""


def parse_amount(text: str) -> str:
    if not text:
        return ""

    match = None
    for pattern in AMOUNT_PATTERNS:
        match = pattern.search(text)
        if match:
            break
    if not match:
        return ""

    raw_digits = match.group(1).strip()
    digits = re.sub(r"[\s,]", "", raw_digits)
    try:
        numeric = float(digits)
    except ValueError:
        return ""

    if numeric.is_integer():
        return f"PKR {int(numeric):,}"
    return f"PKR {numeric:,.2f}"


def parse_date(text: str) -> str:
    if not text:
        return ""

    for pattern in DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        value = match.group(1).replace("/", "-")
        if len(value.split("-")[0]) == 4:
            return value
        if value[0].isdigit() and value.count("-") == 2:
            day, month, year = value.split("-")
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        try:
            parsed = datetime.strptime(value, "%d %B %Y")
        except ValueError:
            try:
                parsed = datetime.strptime(value, "%d %b %Y")
            except ValueError:
                continue
        return parsed.strftime("%Y-%m-%d")
    return ""


def parse_time(text: str) -> str:
    if not text:
        return ""

    match = TIME_PATTERN.search(text)
    if not match:
        return ""

    value = match.group(1).upper().replace(" ", "")
    if value.endswith("AM") or value.endswith("PM"):
        clean = value[:-2]
        if clean.count(":") == 2:
            clean = clean.rsplit(":", 1)[0]
        return f"{clean} {value[-2:]}"

    try:
        raw_time = datetime.strptime(value, "%H:%M")
    except ValueError:
        try:
            raw_time = datetime.strptime(value, "%H:%M:%S")
        except ValueError:
            return ""
    return raw_time.strftime("%I:%M %p")


def parse_party(text: str, role: str) -> str:
    if not text:
        return ""

    patterns = PARTY_PATTERNS.get(role, [])
    for line in text.splitlines():
        candidate_line = line.strip()
        if not candidate_line:
            continue
        for pattern in patterns:
            match = pattern.search(candidate_line)
            if not match:
                continue
            candidate = sanitize_party(match.group(1))
            if candidate:
                return candidate
    return ""


def sanitize_party(value: str) -> str:
    candidate = re.split(r"\s{2,}|(?:txn|trx|invoice|receipt|amount)\b", value, maxsplit=1, flags=re.IGNORECASE)[0]
    candidate = re.sub(r"[^A-Za-z0-9&().,\- ]", "", candidate).strip(" -:")
    if len(candidate) < 2:
        return ""
    return candidate[:60]


def fallback_transaction_id(file_hash: str) -> str:
    return f"OCR-{file_hash[:8].upper()}"


def try_parse_template(text: str) -> dict[str, str]:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    fields = {}
    lower_text = text.lower()

    # 1. Bank AL Habib Template (Green UI, CM ID)
    if "alhabib" in lower_text.replace(" ", "") or "raastpayment" in lower_text or "payvia\nraastp2p" in lower_text.replace(" ", ""):
        # Transaction ID (e.g. CM126466211417005)
        id_match = re.search(r"\b(CM\d+)\b", text, re.IGNORECASE)
        if id_match:
            fields["transaction_id"] = id_match.group(1).upper()

        # Amount
        amt_match = re.search(r"Amount\s*\n\s*(?:PKR|Rs\.?)\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if amt_match:
            fields["amount"] = clean_amount_val(amt_match.group(1))

        # Date & Time (e.g. 2026-07-07T05:31:31)
        dt_match = re.search(r"TransactionDate&Time\s*\n\s*(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})", text, re.IGNORECASE)
        if dt_match:
            fields["date"] = dt_match.group(1)
            fields["time"] = parse_time_value(dt_match.group(2))

        # Receiver (Beneficiary Name)
        receiver_match = re.search(r"BeneficiaryName\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if receiver_match:
            fields["receiver"] = receiver_match.group(1).strip()

    # 2. Bank of Punjab (BOP) Template
    elif "paidfromaccounttitle" in lower_text or "transaction reference no." in lower_text:
        # Transaction ID
        id_match = re.search(r"Transaction\s*Reference\s*No\.\s*\n\s*(\d+)", text, re.IGNORECASE)
        if id_match:
            fields["transaction_id"] = id_match.group(1)

        # Amount (e.g. PKR 100.00)
        amt_match = re.search(r"SUCCESS!\s*\n\s*(?:PKR|Rs\.?)\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if not amt_match:
            amt_match = re.search(r"(?:PKR|Rs\.?)\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if amt_match:
            fields["amount"] = clean_amount_val(amt_match.group(1))

        # Date & Time (e.g. 7-Jul-2026-5:52:17AM)
        dt_match = re.search(r"(\d{1,2}-[A-Za-z]{3}-\d{4})-(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)", text, re.IGNORECASE)
        if dt_match:
            raw_date = dt_match.group(1).replace("-", " ")
            fields["date"] = parse_date_value(raw_date)
            fields["time"] = parse_time_value(dt_match.group(2))

        # Sender (Paid From Account Title)
        sender_match = re.search(r"PaidFromAccountTitle\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if sender_match:
            fields["sender"] = sender_match.group(1).strip()

        # Receiver (Payee Name)
        receiver_match = re.search(r"PayeeName\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if receiver_match:
            fields["receiver"] = receiver_match.group(1).strip()

    # 3. UBL (United Bank Limited) Template
    elif "ubl" in lower_text or "unitedbank" in lower_text or "transactiondetails\n" in lower_text.replace(" ", ""):
        # Date & Time (e.g. 07July,2026 and 05:56AM)
        d_match = re.search(r"(\d{1,2}\s*[A-Za-z]+,\s*\d{4})", text, re.IGNORECASE)
        if d_match:
            raw_date = d_match.group(1).replace(",", "").strip()
            fields["date"] = parse_date_value(raw_date)

        t_match = re.search(r"(\d{2}:\d{2}\s*(?:AM|PM)?)", text, re.IGNORECASE)
        if t_match:
            fields["time"] = parse_time_value(t_match.group(1))

        # Amount
        amt_match = re.search(r"Amount\s*\n\s*(?:PKR|Rs\.?)\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if amt_match:
            fields["amount"] = clean_amount_val(amt_match.group(1))

        # Sender (Line before From)
        sender_match = re.search(r"([^\n]+)\s*\n\s*From", text, re.IGNORECASE)
        if sender_match:
            fields["sender"] = sender_match.group(1).strip()

        # Receiver (Line before To)
        receiver_match = re.search(r"([^\n]+)\s*\n\s*To", text, re.IGNORECASE)
        if receiver_match:
            fields["receiver"] = receiver_match.group(1).strip()

    # 4. JazzCash / TID Template
    elif "jazzcash" in lower_text or "tid:" in lower_text:
        # Transaction ID
        tid_match = re.search(r"tid[:\s]*(\d+)", text, re.IGNORECASE)
        if tid_match:
            fields["transaction_id"] = tid_match.group(1)

        # Date & Time (e.g. On 07 Jul 2026 at 05:34 or On07Jul2026at05:34)
        dt_match = re.search(r"On\s*(\d{1,2}\s*[A-Za-z]{3}\s*\d{4})\s*at\s*(\d{2}:\d{2})", text, re.IGNORECASE)
        if dt_match:
            raw_date = dt_match.group(1).strip()
            # Clean spaces if OCR joined them
            if len(raw_date) == 9:  # DDMMMYYYY (e.g. 07Jul2026)
                raw_date = f"{raw_date[:2]} {raw_date[2:5]} {raw_date[5:]}"
            fields["date"] = parse_date_value(raw_date)
            fields["time"] = parse_time_value(dt_match.group(2))

        # Amount
        amt_match = re.search(r"Rs\.\s*([0-9, ]+(?:\.[0-9]{2})?)", text)
        if amt_match:
            fields["amount"] = clean_amount_val(amt_match.group(1))

        # Sender (From)
        sender_match = re.search(r"From\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if sender_match:
            fields["sender"] = sender_match.group(1).strip()

        # Receiver (To)
        receiver_match = re.search(r"To\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if receiver_match:
            fields["receiver"] = receiver_match.group(1).strip()

    # 5. NayaPay Template
    # 5. MCB Template
    elif "refnumber" in lower_text.replace(" ", "") and "paidby" in lower_text.replace(" ", ""):
        id_match = re.search(r"Ref\s*Number\s*\n\s*([A-Z0-9]+)", text, re.IGNORECASE)
        if id_match:
            fields["transaction_id"] = id_match.group(1).upper()

        amt_match = re.search(r"Amount\s*Sent\s*\n\s*(?:PKR|Rs\.?)\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if amt_match:
            fields["amount"] = clean_amount_val(amt_match.group(1))

        # Date: 07Jul2026at6:01AM
        dt_match = re.search(r"(\d{1,2}\s*[A-Za-z]{3}\s*\d{4})\s*at\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)", text, re.IGNORECASE)
        if dt_match:
            raw_date = dt_match.group(1).strip()
            if len(raw_date) == 9:  # DDMMMYYYY
                raw_date = f"{raw_date[:2]} {raw_date[2:5]} {raw_date[5:]}"
            fields["date"] = parse_date_value(raw_date)
            fields["time"] = parse_time_value(dt_match.group(2))

        sender_match = re.search(r"Paid\s*By\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if sender_match:
            fields["sender"] = sender_match.group(1).strip()

        receiver_match = re.search(r"Sent\s*To\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if receiver_match:
            fields["receiver"] = receiver_match.group(1).strip()

    # 6. Easypaisa Template
    elif "easypaisa" in lower_text:
        id_match = re.search(r"ID#\s*(\d+)", text, re.IGNORECASE)
        if id_match:
            fields["transaction_id"] = id_match.group(1)

        # Total Amount Rs.500.00
        amt_match = re.search(r"Total\s*Amount\s*\n\s*(?:PKR|Rs\.?)\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if not amt_match:
            amt_match = re.search(r"Amount\s*\n\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if amt_match:
            fields["amount"] = clean_amount_val(amt_match.group(1))

        # Date & Time: 06-Jul-202610:29PM
        dt_match = re.search(r"(\d{1,2}-[A-Za-z]{3}-\d{4})\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)", text, re.IGNORECASE)
        if dt_match:
            fields["date"] = parse_date_value(dt_match.group(1))
            fields["time"] = parse_time_value(dt_match.group(2))

        sender_match = re.search(r"Sent\s*by\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if sender_match:
            fields["sender"] = sender_match.group(1).strip()

        receiver_match = re.search(r"Sentto\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if receiver_match:
            fields["receiver"] = receiver_match.group(1).strip()

    # 7. SadaPay Template (Disambiguated from NayaPay destination bank keyword)
    elif "sadapay" in lower_text and "destinationbank" not in lower_text:
        id_match = re.search(r"Referencenumber\s*\n\s*([A-Za-z0-9\-]+)", text, re.IGNORECASE)
        if id_match:
            fields["transaction_id"] = re.sub(r"[^A-Za-z0-9]", "", id_match.group(1)).upper()

        # Amount: Rs.1 (Find first match after Share)
        share_index = lower_text.find("share")
        if share_index != -1:
            sub_text = lower_text[share_index:]
            amt_match = re.search(r"(?:rs\.?|pkr)\s*([0-9, ]+(?:\.[0-9]{2})?)", sub_text)
            if amt_match:
                fields["amount"] = clean_amount_val(amt_match.group(1))

        # Date & Time: 07 July2026,06:02AM
        dt_match = re.search(r"(\d{1,2}\s*[A-Za-z]+\s*\d{4}),\s*(\d{2}:\d{2}\s*(?:AM|PM)?)", text, re.IGNORECASE)
        if dt_match:
            raw_date = dt_match.group(1).strip()
            fields["date"] = parse_date_value(raw_date)
            fields["time"] = parse_time_value(dt_match.group(2))

        # Sender & Receiver (Munazza Razzaqto\nMUHAMMADJAZIB)
        names_match = re.search(r"([^\n]+)to\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if names_match:
            fields["sender"] = names_match.group(1).strip()
            fields["receiver"] = names_match.group(2).strip()

    # 8. NayaPay Template
    elif "nayapay" in lower_text:
        # Transaction ID
        id_match = re.search(r"Transaction\s*ID\s*\n\s*([a-z0-9]{16,32})", text, re.IGNORECASE)
        if id_match:
            fields["transaction_id"] = id_match.group(1).upper()

        # Amount
        amt_match = re.search(r"Amount\s*Sent\s*\n\s*(?:PKR|Rs\.?)\s*([0-9, ]+(?:\.[0-9]{2})?)", text, re.IGNORECASE)
        if amt_match:
            fields["amount"] = clean_amount_val(amt_match.group(1))

        # Date & Time (e.g. 07Jul2026,05:29AM)
        dt_match = re.search(r"(\d{1,2}\s*[A-Za-z]{3}\s*\d{4}),\s*(\d{2}:\d{2}\s*(?:AM|PM)?)", text, re.IGNORECASE)
        if dt_match:
            raw_date = dt_match.group(1).strip()
            if len(raw_date) == 9:  # DDMMMYYYY
                raw_date = f"{raw_date[:2]} {raw_date[2:5]} {raw_date[5:]}"
            fields["date"] = parse_date_value(raw_date)
            fields["time"] = parse_time_value(dt_match.group(2))

        # Sender (Source Acc. Title)
        sender_match = re.search(r"Source\s*Acc\.\s*Title\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if sender_match:
            fields["sender"] = sender_match.group(1).strip()

        # Receiver (Destination Acc. Title)
        receiver_match = re.search(r"DestinationAcc\.Title\s*\n\s*([^\n]+)", text, re.IGNORECASE)
        if receiver_match:
            fields["receiver"] = receiver_match.group(1).strip()

    return fields


def parse_date_value(value: str) -> str:
    value = value.replace("/", "-")
    # Clean spaces (e.g. "07July 2026" or "07July2026" -> "07 July 2026")
    value = re.sub(r"(\d{1,2})([A-Za-z]+)\s*(\d{4})", r"\1 \2 \3", value)

    # Try standard string date conversions first to handle month names correctly (Jul, July, etc.)
    for fmt in ("%d-%b-%Y", "%d %b %Y", "%d-%B-%Y", "%d %B %Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Fallback to direct hyphen split if numeric only
    if value[0].isdigit() and value.count("-") == 2:
        parts = value.split("-")
        if len(parts[0]) == 4:
            return value
        day, month, year = parts
        if day.isdigit() and month.isdigit() and year.isdigit():
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return ""


def parse_time_value(value: str) -> str:
    value = value.upper().replace(" ", "")
    if value.endswith("AM") or value.endswith("PM"):
        clean = value[:-2]
        suffix = value[-2:]
        if ":" in clean:
            parts = clean.split(":")
            return f"{parts[0].zfill(2)}:{parts[1].zfill(2)} {suffix}"

    if ":" in value:
        parts = value.split(":")
        try:
            hours = int(parts[0])
            minutes = int(parts[1])
            suffix = "AM" if hours < 12 else "PM"
            display_hours = hours if hours <= 12 else hours - 12
            if display_hours == 0:
                display_hours = 12
            return f"{str(display_hours).zfill(2)}:{str(minutes).zfill(2)} {suffix}"
        except ValueError:
            pass
    return ""


def clean_amount_val(val: str) -> str:
    cleaned = re.sub(r"[\s,]", "", val)
    try:
        numeric = float(cleaned)
        if numeric.is_integer():
            return f"PKR {int(numeric):,}"
        return f"PKR {numeric:,.2f}"
    except ValueError:
        return ""
