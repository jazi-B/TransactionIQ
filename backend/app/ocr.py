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
        r"(?:amount|total|paid|payment)\s*[:.\-]?\s*(?:pkr|rs\.?|aed|usd)?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)",
        re.IGNORECASE,
    ),
    re.compile(r"(?:pkr|rs\.?|aed|usd)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)", re.IGNORECASE),
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
        re.compile(r"(?:sender|from|paid by|payer|customer|account holder)\s*[:.\-]\s*(.+)", re.IGNORECASE),
    ],
    "receiver": [
        re.compile(r"(?:receiver|to|paid to|payee|merchant|beneficiary)\s*[:.\-]\s*(.+)", re.IGNORECASE),
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

    transaction_id = parse_transaction_id(text)
    amount = parse_amount(text)
    date = parse_date(text)
    time = parse_time(text)
    sender = parse_party(text, "sender")
    receiver = parse_party(text, "receiver")

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

    digits = match.group(1).replace(",", "")
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
