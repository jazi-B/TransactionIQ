from __future__ import annotations

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .config import get_config
from .deps import get_current_user, require_admin
from .repository import repository
from .schemas import (
    CreateUserRequest,
    DashboardSummaryResponse,
    LoginRequest,
    LoginResponse,
    ManagedUserResponse,
    ResetPasswordRequest,
    SaveTransactionRequest,
    TransactionResponse,
    UploadProcessResponse,
    UserResponse,
)
from .security import verify_password

config = get_config()
app = FastAPI(title="Transaction IQ API", version="0.1.0")
MAX_UPLOAD_SIZE_BYTES = 12 * 1024 * 1024
READ_CHUNK_SIZE_BYTES = 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(config.cors_allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "storage": repository.backend_name}


async def read_upload_bytes(file: UploadFile) -> bytes:
    chunks = bytearray()

    while True:
        chunk = await file.read(READ_CHUNK_SIZE_BYTES)
        if not chunk:
            break
        chunks.extend(chunk)
        if len(chunks) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds the 12 MB upload limit.",
            )

    return bytes(chunks)


def perform_login(payload: LoginRequest, expected_role: str) -> LoginResponse:
    user = repository.find_user_by_email(payload.email)
    if not user or user["role"] != expected_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials for this login.",
        )
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive. Contact the administrator.",
        )

    if not verify_password(payload.password, user["salt"], user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials for this login.",
        )

    token = repository.create_session(user["id"])
    return LoginResponse(access_token=token, user=repository.user_response(user))


@app.post("/api/auth/admin/login", response_model=LoginResponse)
def admin_login(payload: LoginRequest) -> LoginResponse:
    return perform_login(payload, "admin")


@app.post("/api/auth/user/login", response_model=LoginResponse)
def user_login(payload: LoginRequest) -> LoginResponse:
    return perform_login(payload, "staff")


@app.post("/api/auth/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: CreateUserRequest) -> LoginResponse:
    try:
        user, _managed_user = repository.register_user(payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    token = repository.create_session(user["id"])
    return LoginResponse(access_token=token, user=repository.user_response(user))


@app.get("/api/auth/me", response_model=UserResponse)
def auth_me(user: dict = Depends(get_current_user)) -> UserResponse:
    return repository.user_response(user)


@app.post("/api/auth/logout")
def auth_logout(
    authorization: str = Header(default=""),
    user: dict = Depends(get_current_user),
) -> dict[str, str]:
    del user
    token = authorization.replace("Bearer ", "", 1).strip()
    repository.clear_session(token)
    return {"status": "signed_out"}


@app.get("/api/dashboard/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(user: dict = Depends(require_admin)) -> DashboardSummaryResponse:
    del user
    return repository.dashboard_summary()


@app.get("/api/transactions", response_model=list[TransactionResponse])
def list_transactions(user: dict = Depends(get_current_user)) -> list[TransactionResponse]:
    return repository.list_transactions(user)


@app.get("/api/users", response_model=list[ManagedUserResponse])
def list_users(user: dict = Depends(require_admin)) -> list[ManagedUserResponse]:
    del user
    return repository.list_managed_users()


@app.post("/api/users", response_model=ManagedUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    user: dict = Depends(require_admin),
) -> ManagedUserResponse:
    del user
    try:
        return repository.create_user(payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@app.post("/api/users/{user_id}/deactivate", response_model=ManagedUserResponse)
def deactivate_user(
    user_id: str,
    user: dict = Depends(require_admin),
) -> ManagedUserResponse:
    del user
    try:
        record = repository.deactivate_user(user_id)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return record


@app.post("/api/users/{user_id}/reset-password", response_model=ManagedUserResponse)
def reset_user_password(
    user_id: str,
    payload: ResetPasswordRequest,
    user: dict = Depends(require_admin),
) -> ManagedUserResponse:
    del user
    try:
        record = repository.reset_user_password(user_id, payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return record


@app.post("/api/uploads/process", response_model=UploadProcessResponse)
async def process_upload(
    file: UploadFile = File(...),
    channel: str = Form(...),
    user: dict = Depends(get_current_user),
) -> UploadProcessResponse:
    del user
    file_name = file.filename or "uploaded-receipt.png"
    file_bytes = await read_upload_bytes(file)
    draft, cached, source = repository.build_upload_draft(file_name, channel, file_bytes)
    duplicate = repository.find_duplicate(draft.transaction_id)

    if duplicate:
        repository.add_duplicate_activity(draft.transaction_id, channel)
        return UploadProcessResponse(
            ok=False,
            draft=draft,
            duplicate_id=duplicate.transaction_id,
            message="This transaction has already been submitted.",
        )

    return UploadProcessResponse(
        ok=True,
        draft=draft,
        message=(
            "Upload processed successfully from cached OCR result."
            if cached
            else f"Upload processed successfully using {source} extraction."
        ),
    )


@app.post("/api/transactions", response_model=TransactionResponse)
def create_transaction(
    payload: SaveTransactionRequest,
    user: dict = Depends(get_current_user),
) -> TransactionResponse:
    if payload.transaction_id.strip().upper().startswith("OCR-"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a verified reference ID before saving this transaction.",
        )
    record = repository.create_transaction(user, payload)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction has already been submitted.",
        )
    return record


@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    user: dict = Depends(require_admin),
) -> dict[str, str]:
    del user
    success = repository.delete_transaction(transaction_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )
    return {"status": "deleted"}
