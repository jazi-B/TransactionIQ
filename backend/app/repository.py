from __future__ import annotations

from copy import deepcopy
from datetime import datetime

from .schemas import (
    ActivityResponse,
    CreateUserRequest,
    DashboardSummaryResponse,
    ManagedUserResponse,
    ResetPasswordRequest,
    SaveTransactionRequest,
    TransactionResponse,
    UpdateTransactionRequest,
    UploadDraftResponse,
    UserResponse,
)
from .security import create_access_token, hash_password
from .ocr import current_date, current_time, process_receipt
from .config import get_config


SUPPORTED_STORAGE_CHANNELS = {"JazzCash", "Easypaisa", "Bank Transfer"}


def normalize_channel(channel: str) -> str:
    candidate = channel.strip()
    if candidate in SUPPORTED_STORAGE_CHANNELS:
        return candidate
    return "Bank Transfer"


class InMemoryRepository:
    def __init__(self) -> None:
        self._users = self._seed_users()
        self._transactions = self._seed_transactions()
        self._activities = self._seed_activities()
        self._sessions: dict[str, str] = {}
        self._upload_cache: dict[str, UploadDraftResponse] = {}
        self.backend_name = "in-memory"

    def _seed_users(self) -> dict[str, dict]:
        config = get_config()
        users = [
            {
                "id": "user-admin-01",
                "name": "Finance Admin",
                "email": "admin@transactioniq.local",
                "password": config.admin_bootstrap_password,
                "role": "admin",
                "department": "Finance Control",
                "is_active": True,
                "created_at": "2026-07-01T08:00:00",
            },
        ]
        data: dict[str, dict] = {}
        for user in users:
            salt = f"salt-{user['id']}"
            data[user["id"]] = {
                **user,
                "salt": salt,
                "password_hash": hash_password(user["password"], salt),
            }
        return data

    def _seed_transactions(self) -> list[TransactionResponse]:
        return []

    def _seed_activities(self) -> list[ActivityResponse]:
        return []

    def find_user_by_email(self, email: str) -> dict | None:
        normalized = email.lower()
        for user in self._users.values():
            if user["email"].lower() == normalized:
                return user
        return None

    def get_user(self, user_id: str) -> dict | None:
        return self._users.get(user_id)

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

    def list_managed_users(self) -> list[ManagedUserResponse]:
        users = sorted(
            self._users.values(),
            key=lambda item: (item["role"] != "admin", item["name"].lower()),
        )
        return [self.managed_user_response(user) for user in users]

    def create_user(self, payload: CreateUserRequest) -> ManagedUserResponse:
        if self.find_user_by_email(payload.email):
            raise ValueError("A user with this email already exists.")

        staff_count = len([user for user in self._users.values() if user["role"] == "staff"])
        user_id = f"user-staff-{staff_count + 1:02d}"
        created_at = datetime.utcnow().isoformat()
        salt = f"salt-{user_id}"
        user = {
            "id": user_id,
            "name": payload.name.strip(),
            "email": payload.email.strip().lower(),
            "password": payload.password,
            "role": "staff",
            "department": "Operations",
            "is_active": True,
            "created_at": created_at,
            "salt": salt,
            "password_hash": hash_password(payload.password, salt),
        }
        self._users[user_id] = user
        self._activities.insert(
            0,
            ActivityResponse(
                id=f"activity-{len(self._activities) + 1:03d}",
                text=f"Finance Admin created staff account for {user['name']}.",
                tone="success",
                created_at=created_at,
            ),
        )
        self._activities = self._activities[:12]
        return self.managed_user_response(user)

    def register_user(self, payload: CreateUserRequest) -> tuple[dict, ManagedUserResponse]:
        if self.find_user_by_email(payload.email):
            raise ValueError("A user with this email already exists.")

        staff_count = len([user for user in self._users.values() if user["role"] == "staff"])
        user_id = f"user-staff-{staff_count + 1:02d}"
        created_at = datetime.utcnow().isoformat()
        salt = f"salt-{user_id}"
        user = {
            "id": user_id,
            "name": payload.name.strip(),
            "email": payload.email.strip().lower(),
            "password": payload.password,
            "role": "staff",
            "department": "Operations",
            "is_active": True,
            "created_at": created_at,
            "salt": salt,
            "password_hash": hash_password(payload.password, salt),
        }
        self._users[user_id] = user
        self._activities.insert(
            0,
            ActivityResponse(
                id=f"activity-{len(self._activities) + 1:03d}",
                text=f"{user['name']} completed staff account registration.",
                tone="success",
                created_at=created_at,
            ),
        )
        self._activities = self._activities[:12]
        return user, self.managed_user_response(user)

    def deactivate_user(self, user_id: str) -> ManagedUserResponse | None:
        user = self.get_user(user_id)
        if not user:
            return None
        if user["role"] == "admin":
            raise ValueError("The only admin account cannot be deactivated.")

        user["is_active"] = False
        self.clear_user_sessions(user_id)
        self._activities.insert(
            0,
            ActivityResponse(
                id=f"activity-{len(self._activities) + 1:03d}",
                text=f"Finance Admin deactivated {user['name']}.",
                tone="warning",
                created_at=datetime.utcnow().isoformat(),
            ),
        )
        self._activities = self._activities[:12]
        return self.managed_user_response(user)

    def reset_user_password(
        self, user_id: str, payload: ResetPasswordRequest
    ) -> ManagedUserResponse | None:
        user = self.get_user(user_id)
        if not user:
            return None
        if user["role"] == "admin":
            raise ValueError("The admin account is managed separately.")

        user["password_hash"] = hash_password(payload.password, user["salt"])
        user["password"] = payload.password
        self.clear_user_sessions(user_id)
        self._activities.insert(
            0,
            ActivityResponse(
                id=f"activity-{len(self._activities) + 1:03d}",
                text=f"Finance Admin reset password for {user['name']}.",
                tone="neutral",
                created_at=datetime.utcnow().isoformat(),
            ),
        )
        self._activities = self._activities[:12]
        return self.managed_user_response(user)

    def list_transactions(self, user: dict) -> list[TransactionResponse]:
        if user["role"] == "admin":
            return deepcopy(self._transactions)
        return [item for item in self._transactions if item.uploader_id == user["id"]]

    def find_duplicate(self, transaction_id: str) -> TransactionResponse | None:
        normalized = transaction_id.strip().lower()
        for item in self._transactions:
            if item.transaction_id.strip().lower() == normalized:
                return item
        return None

    def create_transaction(
        self,
        user: dict,
        payload: SaveTransactionRequest,
    ) -> TransactionResponse | None:
        duplicate = self.find_duplicate(payload.transaction_id)
        if duplicate:
            return None

        import uuid
        channel = normalize_channel(payload.channel)
        record = TransactionResponse(
            id=f"record-{int(datetime.utcnow().timestamp() * 1000)}-{uuid.uuid4().hex[:6]}",
            transaction_id=payload.transaction_id.strip(),
            channel=channel,
            uploader_id=user["id"],
            uploader_name=user["name"],
            date=payload.date,
            time=payload.time,
            amount=payload.amount,
            sender=payload.sender,
            receiver=payload.receiver,
            receipt_name=payload.receipt_name,
            status="approved" if user["role"] == "admin" else "review",
            created_at=datetime.utcnow().isoformat(),
        )
        self._transactions.insert(0, record)
        self._activities.insert(
            0,
            ActivityResponse(
                id=f"activity-{len(self._activities) + 1:03d}",
                text=f"{user['name']} submitted {record.transaction_id}.",
                tone="success",
                created_at=datetime.utcnow().isoformat(),
            ),
        )
        self._activities = self._activities[:12]
        return record

    def add_duplicate_activity(self, transaction_id: str, channel: str) -> None:
        self._activities.insert(
            0,
            ActivityResponse(
                id=f"activity-{len(self._activities) + 1:03d}",
                text=f"Duplicate blocked for {transaction_id} from {channel}.",
                tone="warning",
                created_at=datetime.utcnow().isoformat(),
            ),
        )
        self._activities = self._activities[:12]

    def dashboard_summary(self) -> DashboardSummaryResponse:
        total_transactions = len(self._transactions)
        todays_uploads = len([item for item in self._transactions if item.date == current_date()])
        duplicates_blocked = len(
            [item for item in self._activities if "Duplicate blocked" in item.text]
        )
        approved_records = len(
            [item for item in self._transactions if item.status == "approved"]
        )
        return DashboardSummaryResponse(
            total_transactions=total_transactions,
            todays_uploads=todays_uploads,
            duplicates_blocked=duplicates_blocked,
            approved_records=approved_records,
            activities=deepcopy(self._activities[:6]),
            recent_transactions=deepcopy(self._transactions[:4]),
        )

    def delete_transaction(self, transaction_id: str) -> bool:
        for idx, item in enumerate(self._transactions):
            if item.id == transaction_id or item.transaction_id == transaction_id:
                self._transactions.pop(idx)
                self._activities.insert(
                    0,
                    ActivityResponse(
                        id=f"activity-{len(self._activities) + 1:03d}",
                        text=f"Finance Admin deleted transaction {transaction_id}.",
                        tone="warning",
                        created_at=datetime.utcnow().isoformat(),
                    ),
                )
                self._activities = self._activities[:12]
                return True
        return False

    def update_transaction(self, id: str, payload: UpdateTransactionRequest) -> TransactionResponse | None:
        target = None
        for item in self._transactions:
            if item.id == id:
                target = item
                break
        if not target:
            return None

        # Check duplication if transaction_id changed
        new_txn_id = payload.transaction_id.strip()
        if new_txn_id != target.transaction_id:
            duplicate = self.find_duplicate(new_txn_id)
            if duplicate and duplicate.id != id:
                raise ValueError("This transaction ID has already been submitted.")

        target.transaction_id = new_txn_id
        target.sender = payload.sender.strip()
        target.amount = payload.amount.strip()

        self._activities.insert(
            0,
            ActivityResponse(
                id=f"activity-{len(self._activities) + 1:03d}",
                text=f"Finance Admin updated transaction {target.transaction_id}.",
                tone="neutral",
                created_at=datetime.utcnow().isoformat(),
            ),
        )
        self._activities = self._activities[:12]
        return target


    def build_upload_draft(
        self, file_name: str, channel: str, file_bytes: bytes
    ) -> tuple[UploadDraftResponse, bool, str]:
        normalized_channel = normalize_channel(channel)
        extraction = process_receipt(file_bytes, file_name, channel)
        cached_draft = self._upload_cache.get(extraction.file_hash)
        if cached_draft:
            return deepcopy(cached_draft), True, "cache"

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
        return draft, False, extraction.source

def build_repository() -> InMemoryRepository:
    try:
        from .supabase import SupabaseRepository

        return SupabaseRepository()  # type: ignore[return-value]
    except Exception:
        return InMemoryRepository()


repository = build_repository()
