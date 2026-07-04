from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from typing import Any
from urllib import error, parse, request

from .config import get_config
from .ocr import current_date, current_time, process_receipt
from .schemas import (
    ActivityResponse,
    CreateUserRequest,
    DashboardSummaryResponse,
    ManagedUserResponse,
    ResetPasswordRequest,
    SaveTransactionRequest,
    TransactionResponse,
    UploadDraftResponse,
    UserResponse,
)
from .security import create_access_token, hash_password


SUPPORTED_STORAGE_CHANNELS = {"JazzCash", "Easypaisa", "Bank Transfer"}


def normalize_channel(channel: str) -> str:
    candidate = channel.strip()
    if candidate in SUPPORTED_STORAGE_CHANNELS:
        return candidate
    return "Bank Transfer"


class SupabaseRepository:
    def __init__(self) -> None:
        config = get_config()
        if not config.supabase_enabled:
            raise RuntimeError("Supabase configuration is incomplete.")

        self._base_url = f"{config.supabase_url}/rest/v1"
        self._secret_key = config.supabase_secret_key
        self._admin_bootstrap_password = config.admin_bootstrap_password
        self._sessions: dict[str, str] = {}
        self._upload_cache: dict[str, UploadDraftResponse] = {}
        self.backend_name = "supabase"
        self._ensure_seed_data()

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "apikey": self._secret_key,
            "Authorization": f"Bearer {self._secret_key}",
        }
        if extra:
            headers.update(extra)
        return headers

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, str] | None = None,
        body: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        url = f"{self._base_url}/{path}"
        if query:
            url = f"{url}?{parse.urlencode(query)}"

        payload = None
        final_headers = self._headers(headers)
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            final_headers["Content-Type"] = "application/json"

        req = request.Request(url, data=payload, headers=final_headers, method=method)
        try:
            with request.urlopen(req, timeout=15) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else None
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Supabase request failed: {exc.code} {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Supabase connection failed: {exc.reason}") from exc

    def _select(
        self,
        table: str,
        *,
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict]:
        query = {"select": "*"}
        if filters:
            query.update(filters)
        if order:
            query["order"] = order
        if limit is not None:
            query["limit"] = str(limit)
        result = self._request("GET", table, query=query)
        return result if isinstance(result, list) else []

    def _insert(self, table: str, payload: dict | list[dict]) -> Any:
        return self._request(
            "POST",
            table,
            body=payload,
            headers={"Prefer": "return=representation,resolution=merge-duplicates"},
        )

    def _update(self, table: str, filters: dict[str, str], payload: dict) -> list[dict]:
        result = self._request(
            "PATCH",
            table,
            query=filters,
            body=payload,
            headers={"Prefer": "return=representation"},
        )
        return result if isinstance(result, list) else []

    def _delete(self, table: str, filters: dict[str, str]) -> list[dict]:
        result = self._request(
            "DELETE",
            table,
            query=filters,
            headers={"Prefer": "return=representation"},
        )
        return result if isinstance(result, list) else []

    def _remove_placeholder_seed_data(self) -> None:
        self._delete("transactions", {"id": "in.(record-001,record-002,record-003)"})
        self._delete("activity_logs", {"id": "in.(activity-001,activity-002,activity-003)"})
        self._delete("app_users", {"id": "eq.user-staff-01", "email": "eq.staff@transactioniq.local"})

    def _ensure_seed_data(self) -> None:
        self._remove_placeholder_seed_data()
        if not self._select("app_users", limit=1):
            users = [
                {
                    "id": "user-admin-01",
                    "name": "Finance Admin",
                    "email": "admin@transactioniq.local",
                    "password": self._admin_bootstrap_password,
                    "role": "admin",
                    "department": "Finance Control",
                    "is_active": True,
                    "created_at": "2026-07-01T08:00:00",
                },
            ]
            payload = []
            for user in users:
                salt = f"salt-{user['id']}"
                payload.append(
                    {
                        "id": user["id"],
                        "name": user["name"],
                        "email": user["email"],
                        "password_hash": hash_password(user["password"], salt),
                        "salt": salt,
                        "role": user["role"],
                        "department": user["department"],
                        "is_active": user["is_active"],
                        "created_at": user["created_at"],
                    }
                )
            self._insert("app_users", payload)

    def create_session(self, user_id: str) -> str:
        token = create_access_token()
        self._sessions[token] = user_id
        return token

    def get_session_user(self, token: str) -> dict | None:
        user_id = self._sessions.get(token)
        if not user_id:
            return None
        return self.get_user(user_id)

    def clear_session(self, token: str) -> None:
        self._sessions.pop(token, None)

    def clear_user_sessions(self, user_id: str) -> None:
        tokens_to_remove = [
            token for token, session_user_id in self._sessions.items() if session_user_id == user_id
        ]
        for token in tokens_to_remove:
            self._sessions.pop(token, None)

    def user_response(self, user: dict) -> UserResponse:
        return UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            department=user["department"],
        )

    def managed_user_response(self, user: dict) -> ManagedUserResponse:
        return ManagedUserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            department=user["department"],
            is_active=user["is_active"],
            created_at=user["created_at"],
        )

    def _map_transaction(self, row: dict) -> TransactionResponse:
        return TransactionResponse(
            id=row["id"],
            transaction_id=row["transaction_id"],
            channel=row["channel"],
            uploader_id=row["uploader_id"],
            uploader_name=row["uploader_name"],
            date=row["date"],
            time=row["time"],
            amount=row["amount"],
            sender=row["sender"],
            receiver=row["receiver"],
            receipt_name=row["receipt_name"],
            status=row["status"],
            created_at=row["created_at"],
        )

    def _map_activity(self, row: dict) -> ActivityResponse:
        return ActivityResponse(
            id=row["id"],
            text=row["text"],
            tone=row["tone"],
            created_at=row["created_at"],
        )

    def find_user_by_email(self, email: str) -> dict | None:
        rows = self._select("app_users", filters={"email": f"eq.{email.lower()}"}, limit=1)
        return rows[0] if rows else None

    def get_user(self, user_id: str) -> dict | None:
        rows = self._select("app_users", filters={"id": f"eq.{user_id}"}, limit=1)
        return rows[0] if rows else None

    def list_managed_users(self) -> list[ManagedUserResponse]:
        rows = self._select("app_users")
        rows.sort(key=lambda item: (item["role"] != "admin", item["name"].lower()))
        return [self.managed_user_response(row) for row in rows]

    def create_user(self, payload: CreateUserRequest) -> ManagedUserResponse:
        if self.find_user_by_email(payload.email):
            raise ValueError("A user with this email already exists.")

        rows = self._select("app_users")
        staff_count = len([user for user in rows if user["role"] == "staff"])
        user_id = f"user-staff-{staff_count + 1:02d}"
        created_at = datetime.utcnow().isoformat()
        salt = f"salt-{user_id}"
        inserted = self._insert(
            "app_users",
            {
                "id": user_id,
                "name": payload.name.strip(),
                "email": payload.email.strip().lower(),
                "password_hash": hash_password(payload.password, salt),
                "salt": salt,
                "role": "staff",
                "department": "Operations",
                "is_active": True,
                "created_at": created_at,
            },
        )
        self._insert(
            "activity_logs",
            {
                "id": f"activity-{int(datetime.utcnow().timestamp() * 1000)}",
                "text": f"Finance Admin created staff account for {payload.name.strip()}.",
                "tone": "success",
                "created_at": created_at,
            },
        )
        return self.managed_user_response(inserted[0])

    def register_user(self, payload: CreateUserRequest) -> tuple[dict, ManagedUserResponse]:
        if self.find_user_by_email(payload.email):
            raise ValueError("A user with this email already exists.")

        rows = self._select("app_users")
        staff_count = len([user for user in rows if user["role"] == "staff"])
        user_id = f"user-staff-{staff_count + 1:02d}"
        created_at = datetime.utcnow().isoformat()
        salt = f"salt-{user_id}"
        inserted = self._insert(
            "app_users",
            {
                "id": user_id,
                "name": payload.name.strip(),
                "email": payload.email.strip().lower(),
                "password_hash": hash_password(payload.password, salt),
                "salt": salt,
                "role": "staff",
                "department": "Operations",
                "is_active": True,
                "created_at": created_at,
            },
        )
        self._insert(
            "activity_logs",
            {
                "id": f"activity-{int(datetime.utcnow().timestamp() * 1000)}",
                "text": f"{payload.name.strip()} completed staff account registration.",
                "tone": "success",
                "created_at": created_at,
            },
        )
        user = inserted[0]
        return user, self.managed_user_response(user)

    def deactivate_user(self, user_id: str) -> ManagedUserResponse | None:
        user = self.get_user(user_id)
        if not user:
            return None
        if user["role"] == "admin":
            raise ValueError("The only admin account cannot be deactivated.")

        updated = self._update("app_users", {"id": f"eq.{user_id}"}, {"is_active": False})
        self.clear_user_sessions(user_id)
        self._insert(
            "activity_logs",
            {
                "id": f"activity-{int(datetime.utcnow().timestamp() * 1000)}",
                "text": f"Finance Admin deactivated {user['name']}.",
                "tone": "warning",
                "created_at": datetime.utcnow().isoformat(),
            },
        )
        return self.managed_user_response(updated[0]) if updated else None

    def reset_user_password(
        self, user_id: str, payload: ResetPasswordRequest
    ) -> ManagedUserResponse | None:
        user = self.get_user(user_id)
        if not user:
            return None
        if user["role"] == "admin":
            raise ValueError("The admin account is managed separately.")

        updated = self._update(
            "app_users",
            {"id": f"eq.{user_id}"},
            {"password_hash": hash_password(payload.password, user["salt"])},
        )
        self.clear_user_sessions(user_id)
        self._insert(
            "activity_logs",
            {
                "id": f"activity-{int(datetime.utcnow().timestamp() * 1000)}",
                "text": f"Finance Admin reset password for {user['name']}.",
                "tone": "neutral",
                "created_at": datetime.utcnow().isoformat(),
            },
        )
        return self.managed_user_response(updated[0]) if updated else None

    def list_transactions(self, user: dict) -> list[TransactionResponse]:
        filters = None if user["role"] == "admin" else {"uploader_id": f"eq.{user['id']}"}
        rows = self._select("transactions", filters=filters, order="created_at.desc")
        return [self._map_transaction(row) for row in rows]

    def find_duplicate(self, transaction_id: str) -> TransactionResponse | None:
        normalized_transaction_id = transaction_id.strip()
        rows = self._select(
            "transactions",
            filters={"transaction_id": f"eq.{normalized_transaction_id}"},
            limit=1,
        )
        return self._map_transaction(rows[0]) if rows else None

    def create_transaction(
        self,
        user: dict,
        payload: SaveTransactionRequest,
    ) -> TransactionResponse | None:
        duplicate = self.find_duplicate(payload.transaction_id)
        if duplicate:
            return None

        rows = self._select("transactions")
        channel = normalize_channel(payload.channel)
        record = {
            "id": f"record-{len(rows) + 1:03d}",
            "transaction_id": payload.transaction_id.strip(),
            "channel": channel,
            "uploader_id": user["id"],
            "uploader_name": user["name"],
            "date": payload.date,
            "time": payload.time,
            "amount": payload.amount,
            "sender": payload.sender,
            "receiver": payload.receiver,
            "receipt_name": payload.receipt_name,
            "status": "approved" if user["role"] == "admin" else "review",
            "created_at": datetime.utcnow().isoformat(),
        }
        inserted = self._insert("transactions", record)
        self._insert(
            "activity_logs",
            {
                "id": f"activity-{int(datetime.utcnow().timestamp() * 1000)}",
                "text": f"{user['name']} submitted {record['transaction_id']}.",
                "tone": "success",
                "created_at": datetime.utcnow().isoformat(),
            },
        )
        return self._map_transaction(inserted[0])

    def add_duplicate_activity(self, transaction_id: str, channel: str) -> None:
        self._insert(
            "activity_logs",
            {
                "id": f"activity-{int(datetime.utcnow().timestamp() * 1000)}",
                "text": f"Duplicate blocked for {transaction_id} from {channel}.",
                "tone": "warning",
                "created_at": datetime.utcnow().isoformat(),
            },
        )

    def dashboard_summary(self) -> DashboardSummaryResponse:
        transactions = self._select("transactions", order="created_at.desc")
        activities = self._select("activity_logs", order="created_at.desc")
        total_transactions = len(transactions)
        todays_uploads = len([item for item in transactions if item["date"] == current_date()])
        duplicates_blocked = len(
            [item for item in activities if "Duplicate blocked" in item["text"]]
        )
        approved_records = len([item for item in transactions if item["status"] == "approved"])
        return DashboardSummaryResponse(
            total_transactions=total_transactions,
            todays_uploads=todays_uploads,
            duplicates_blocked=duplicates_blocked,
            approved_records=approved_records,
            activities=[self._map_activity(item) for item in activities[:6]],
            recent_transactions=[self._map_transaction(item) for item in transactions[:4]],
        )

    def build_upload_draft(
        self, file_name: str, channel: str, file_bytes: bytes
    ) -> tuple[UploadDraftResponse, bool, str]:
        normalized_channel = normalize_channel(channel)
        extraction = process_receipt(file_bytes, file_name, channel)
        cached_draft = self._upload_cache.get(extraction.file_hash)
        if cached_draft:
            return deepcopy(cached_draft), True, "cache"

        rows = self._select(
            "processed_upload_cache",
            filters={"file_hash": f"eq.{extraction.file_hash}"},
            limit=1,
        )
        if rows:
            row = rows[0]
            draft = UploadDraftResponse(
                channel=row["channel"],
                receipt_name=row["receipt_name"],
                transaction_id=row["transaction_id"],
                date=row["date"],
                time=row["time"],
                amount=row["amount"],
                sender=row["sender"],
                receiver=row["receiver"],
                notes="",
            )
            self._upload_cache[extraction.file_hash] = deepcopy(draft)
            return draft, True, "cache"

        draft = UploadDraftResponse(
            channel=normalized_channel,
            receipt_name=file_name,
            transaction_id=extraction.transaction_id,
            date=extraction.date or current_date(),
            time=extraction.time or current_time(),
            amount=extraction.amount,
            sender=extraction.sender,
            receiver=extraction.receiver,
            notes="",
        )
        self._upload_cache[extraction.file_hash] = deepcopy(draft)
        self._insert(
            "processed_upload_cache",
            {
                "file_hash": extraction.file_hash,
                "channel": draft.channel,
                "receipt_name": draft.receipt_name,
                "transaction_id": draft.transaction_id,
                "amount": draft.amount,
                "date": draft.date,
                "time": draft.time,
                "sender": draft.sender,
                "receiver": draft.receiver,
                "extraction_source": extraction.source,
            },
        )
        return draft, False, extraction.source
