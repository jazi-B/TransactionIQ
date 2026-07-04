export type UserRole = "admin" | "staff"
export type LoginScope = "admin" | "staff"

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
}

export type ManagedUser = {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  isActive: boolean
  createdAt: string
}

export type CreateManagedUserPayload = {
  name: string
  email: string
  password: string
}

export type RegisterUserPayload = {
  name: string
  email: string
  password: string
}

export type TransactionStatus = "approved" | "review" | "duplicate_blocked"

export type TransactionChannel =
  | "Payment Receipt"
  | "Invoice"
  | "Bank Transfer"
  | "Cash Deposit"
  | "Other"
  | "JazzCash"
  | "Easypaisa"

export type Transaction = {
  id: string
  transactionId: string
  channel: TransactionChannel
  uploaderId: string
  uploaderName: string
  date: string
  time: string
  amount: string
  sender: string
  receiver: string
  receiptName: string
  status: TransactionStatus
  createdAt: string
}

export type ActivityItem = {
  id: string
  text: string
  tone: "neutral" | "success" | "warning"
  createdAt: string
}

export type UploadDraft = {
  channel: TransactionChannel
  receiptName: string
  transactionId: string
  date: string
  time: string
  amount: string
  sender: string
  receiver: string
  notes: string
}

export type UploadProcessingResult =
  | {
      ok: true
      draft: UploadDraft
      message: string
    }
  | {
      ok: false
      draft: UploadDraft
      duplicateId?: string
      message: string
    }

export type DashboardSummary = {
  totalTransactions: number
  todaysUploads: number
  duplicatesBlocked: number
  approvedRecords: number
  activities: ActivityItem[]
  recentTransactions: Transaction[]
}
