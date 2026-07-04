import type { LoginPreset, UploadDraft, UserRole } from "@/types/app"

type AppNavigationItem = {
  label: string
  path: string
  roles?: UserRole[]
}

export const heroMetrics = [
  { label: "Duplicate attempts blocked", value: "12,480", detail: "last 90 days" },
  { label: "Average OCR confidence", value: "94.2%", detail: "operations baseline" },
  { label: "Finance teams onboarded", value: "37", detail: "enterprise clients" },
  { label: "Review turnaround", value: "43 sec", detail: "average per upload" },
]

export const featureCards = [
  {
    title: "Controlled intake",
    description:
      "Staff uploads JazzCash, Easypaisa, or bank transfer screenshots into a structured intake workflow.",
  },
  {
    title: "OCR verification",
    description:
      "Transaction ID, date, time, and amount remain editable so OCR mistakes can be corrected before submission.",
  },
  {
    title: "Duplicate protection",
    description:
      "The system checks the transaction identifier before save and blocks repeated submissions instantly.",
  },
  {
    title: "Operations visibility",
    description:
      "Admins monitor uploads, user activity, suspicious attempts, and reporting from a central dashboard.",
  },
]

export const workflowSteps = [
  {
    id: "01",
    title: "Receipt submission",
    text: "Employee uploads a receipt image to the controlled transaction intake queue.",
  },
  {
    id: "02",
    title: "OCR extraction",
    text: "System reads transaction ID, date, time, amount, and sender information.",
  },
  {
    id: "03",
    title: "Operator correction",
    text: "User reviews the fields and fixes OCR mistakes before final submission.",
  },
  {
    id: "04",
    title: "Duplicate validation",
    text: "System compares the transaction ID against previous records and blocks collisions.",
  },
  {
    id: "05",
    title: "Secure archive",
    text: "Unique entries are stored with receipt metadata and uploader ownership.",
  },
]

export const loginPresets: LoginPreset[] = [
  {
    id: "user-admin-01",
    name: "Finance Admin",
    email: "admin@transactioniq.local",
    password: "admin123",
    role: "admin",
    department: "Finance Control",
  },
  {
    id: "user-staff-01",
    name: "Areeba Khan",
    email: "staff@transactioniq.local",
    password: "staff123",
    role: "staff",
    department: "Regional Sales",
  },
]

export const emptyUploadDraft: UploadDraft = {
  channel: "JazzCash",
  receiptName: "",
  transactionId: "",
  date: "2026-07-04",
  time: "09:42 AM",
  amount: "",
  sender: "",
  receiver: "",
  notes: "",
}

export const appNavigation: AppNavigationItem[] = [
  { label: "Dashboard", path: "/dashboard", roles: ["admin"] },
  { label: "Users", path: "/users", roles: ["admin"] },
  { label: "Upload", path: "/upload" },
  { label: "Transactions", path: "/transactions" },
]
