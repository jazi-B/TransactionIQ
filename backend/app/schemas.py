from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


UserRole = Literal["admin", "staff"]
TransactionStatus = Literal["approved", "review", "duplicate_blocked"]
TransactionChannel = Literal["JazzCash", "Easypaisa", "Bank Transfer"]


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    department: str


class ManagedUserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    department: str
    is_active: bool
    created_at: str


class CreateUserRequest(BaseModel):
    name: str
    email: str
    password: str


class ResetPasswordRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    access_token: str
    user: UserResponse


class ActivityResponse(BaseModel):
    id: str
    text: str
    tone: Literal["neutral", "success", "warning"]
    created_at: str


class TransactionResponse(BaseModel):
    id: str
    transaction_id: str
    channel: TransactionChannel
    uploader_id: str
    uploader_name: str
    date: str
    time: str
    amount: str
    sender: str
    receiver: str
    receipt_name: str
    status: TransactionStatus
    created_at: str


class UploadDraftResponse(BaseModel):
    channel: TransactionChannel
    receipt_name: str
    transaction_id: str
    date: str
    time: str
    amount: str
    sender: str
    receiver: str
    notes: str = ""


class UploadProcessResponse(BaseModel):
    ok: bool
    draft: UploadDraftResponse
    duplicate_id: str | None = None
    message: str


class SaveTransactionRequest(BaseModel):
    channel: TransactionChannel
    receipt_name: str
    transaction_id: str
    date: str
    time: str
    amount: str
    sender: str
    receiver: str
    notes: str = ""


class DashboardSummaryResponse(BaseModel):
    total_transactions: int
    todays_uploads: int
    duplicates_blocked: int
    approved_records: int
    activities: list[ActivityResponse]
    recent_transactions: list[TransactionResponse]
