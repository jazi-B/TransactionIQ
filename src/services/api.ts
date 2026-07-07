import type {
  ActivityItem,
  CreateManagedUserPayload,
  DashboardSummary,
  LoginScope,
  ManagedUser,
  RegisterUserPayload,
  Transaction,
  UploadDraft,
  UploadProcessingResult,
  User,
} from "@/types/app"

function normalizeApiBaseUrl(value?: string) {
  const fallback = "http://127.0.0.1:8001/api"
  if (!value) {
    return fallback
  }

  const normalized = value.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\/+$/, "")
  return normalized || fallback
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type RequestOptions = {
  method?: string
  token?: string | null
  body?: BodyInit | null
  headers?: HeadersInit
}

type LoginResponse = {
  access_token: string
  user: {
    id: string
    name: string
    email: string
    role: "admin" | "staff"
    department: string
  }
}

type TransactionApi = {
  id: string
  transaction_id: string
  channel: UploadDraft["channel"]
  uploader_id: string
  uploader_name: string
  date: string
  time: string
  amount: string
  sender: string
  receiver: string
  receipt_name: string
  status: "approved" | "review" | "duplicate_blocked"
  created_at: string
}

type ActivityApi = {
  id: string
  text: string
  tone: "neutral" | "success" | "warning"
  created_at: string
}

type ManagedUserApi = {
  id: string
  name: string
  email: string
  role: "admin" | "staff"
  department: string
  is_active: boolean
  created_at: string
}

function mapUser(user: LoginResponse["user"]): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
  }
}

function mapTransaction(item: TransactionApi): Transaction {
  return {
    id: item.id,
    transactionId: item.transaction_id,
    channel: item.channel,
    uploaderId: item.uploader_id,
    uploaderName: item.uploader_name,
    date: item.date,
    time: item.time,
    amount: item.amount,
    sender: item.sender,
    receiver: item.receiver,
    receiptName: item.receipt_name,
    status: item.status,
    createdAt: item.created_at,
  }
}

function mapActivity(item: ActivityApi): ActivityItem {
  return {
    id: item.id,
    text: item.text,
    tone: item.tone,
    createdAt: item.created_at,
  }
}

function mapManagedUser(user: ManagedUserApi): ManagedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    isActive: user.is_active,
    createdAt: user.created_at,
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null
    throw new ApiError(payload?.detail ?? "Request failed.", response.status)
  }

  return (await response.json()) as T
}

export async function loginWithScope(
  scope: LoginScope,
  email: string,
  password: string,
) {
  const result = await request<LoginResponse>(
    scope === "admin" ? "/auth/admin/login" : "/auth/user/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  )

  return {
    token: result.access_token,
    user: mapUser(result.user),
  }
}

export async function fetchCurrentUser(token: string) {
  const result = await request<LoginResponse["user"]>("/auth/me", { token })
  return mapUser(result)
}

export async function registerStaffUser(payload: RegisterUserPayload) {
  const result = await request<LoginResponse>("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  return {
    token: result.access_token,
    user: mapUser(result.user),
  }
}

export async function signOut(token: string) {
  await request<{ status: string }>("/auth/logout", {
    method: "POST",
    token,
  })
}

export async function fetchDashboardSummary(token: string): Promise<DashboardSummary> {
  const result = await request<{
    total_transactions: number
    todays_uploads: number
    duplicates_blocked: number
    approved_records: number
    activities: ActivityApi[]
    recent_transactions: TransactionApi[]
  }>("/dashboard/summary", { token })

  return {
    totalTransactions: result.total_transactions,
    todaysUploads: result.todays_uploads,
    duplicatesBlocked: result.duplicates_blocked,
    approvedRecords: result.approved_records,
    activities: result.activities.map(mapActivity),
    recentTransactions: result.recent_transactions.map(mapTransaction),
  }
}

export async function fetchTransactions(token: string): Promise<Transaction[]> {
  const result = await request<TransactionApi[]>("/transactions", { token })
  return result.map(mapTransaction)
}

export async function fetchManagedUsers(token: string): Promise<ManagedUser[]> {
  const result = await request<ManagedUserApi[]>("/users", { token })
  return result.map(mapManagedUser)
}

export async function createManagedUser(
  token: string,
  payload: CreateManagedUserPayload,
): Promise<ManagedUser> {
  const result = await request<ManagedUserApi>("/users", {
    method: "POST",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  return mapManagedUser(result)
}

export async function deactivateManagedUser(
  token: string,
  userId: string,
): Promise<ManagedUser> {
  const result = await request<ManagedUserApi>(`/users/${userId}/deactivate`, {
    method: "POST",
    token,
  })
  return mapManagedUser(result)
}

export async function resetManagedUserPassword(
  token: string,
  userId: string,
  password: string,
): Promise<ManagedUser> {
  const result = await request<ManagedUserApi>(`/users/${userId}/reset-password`, {
    method: "POST",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  })
  return mapManagedUser(result)
}

export async function processUploadReceipt(
  token: string,
  file: File,
  channel: UploadDraft["channel"],
): Promise<UploadProcessingResult> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("channel", channel)

  const result = await request<{
    ok: boolean
    draft: {
      channel: UploadDraft["channel"]
      receipt_name: string
      transaction_id: string
      date: string
      time: string
      amount: string
      sender: string
      receiver: string
      notes: string
    }
    duplicate_id?: string | null
    message: string
  }>("/uploads/process", {
    method: "POST",
    token,
    body: formData,
  })

  const draft: UploadDraft = {
    channel: result.draft.channel,
    receiptName: result.draft.receipt_name,
    transactionId: result.draft.transaction_id,
    date: result.draft.date,
    time: result.draft.time,
    amount: result.draft.amount,
    sender: result.draft.sender,
    receiver: result.draft.receiver,
    notes: result.draft.notes,
  }

  if (!result.ok) {
    return {
      ok: false,
      draft,
      duplicateId: result.duplicate_id ?? undefined,
      message: result.message,
    }
  }

  return {
    ok: true,
    draft,
    message: result.message,
  }
}

export async function saveTransaction(
  token: string,
  draft: UploadDraft,
): Promise<Transaction> {
  const result = await request<TransactionApi>("/transactions", {
    method: "POST",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: draft.channel,
      receipt_name: draft.receiptName,
      transaction_id: draft.transactionId,
      date: draft.date,
      time: draft.time,
      amount: draft.amount,
      sender: draft.sender,
      receiver: draft.receiver,
      notes: draft.notes,
    }),
  })

  return mapTransaction(result)
}

export async function deleteTransaction(
  token: string,
  transactionId: string,
): Promise<{ ok: boolean }> {
  await request<{ status: string }>(`/transactions/${transactionId}`, {
    method: "DELETE",
    token,
  })
  return { ok: true }
}

export async function updateTransaction(
  token: string,
  id: string,
  payload: { transactionId: string; sender: string; amount: string },
): Promise<Transaction> {
  const result = await request<TransactionApi>(`/transactions/${id}`, {
    method: "PATCH",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction_id: payload.transactionId,
      sender: payload.sender,
      amount: payload.amount,
    }),
  })
  return mapTransaction(result)
}

