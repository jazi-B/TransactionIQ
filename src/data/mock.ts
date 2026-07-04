import type { UploadDraft, UserRole } from "@/types/app"

type AppNavigationItem = {
  label: string
  path: string
  roles?: UserRole[]
}

function getDefaultDate() {
  return new Date().toISOString().slice(0, 10)
}

function getDefaultTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export const heroMetrics = [
  { label: "Automated intake", value: "Always on", detail: "upload, extract, validate" },
  { label: "Operator review", value: "Editable", detail: "fix extracted fields before save" },
  { label: "Duplicate control", value: "Instant", detail: "pre-save collision blocking" },
  { label: "Access model", value: "Role-based", detail: "admin oversight, staff isolation" },
]

export const featureCards = [
  {
    title: "Controlled intake",
    description:
      "Staff uploads receipts, invoices, deposit slips, and transfer proofs into a controlled intake workflow.",
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
    text: "Employee uploads a payment proof, invoice image, or receipt into the controlled intake queue.",
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
    text: "System compares extracted identifiers against previous records and blocks collisions.",
  },
  {
    id: "05",
    title: "Secure archive",
    text: "Unique entries are stored with receipt metadata and uploader ownership.",
  },
]

export const emptyUploadDraft: UploadDraft = {
  channel: "Bank Transfer",
  receiptName: "",
  transactionId: "",
  date: getDefaultDate(),
  time: getDefaultTime(),
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
