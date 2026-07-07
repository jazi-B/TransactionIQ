import { useEffect, useState } from "react"

import AppShell from "@/components/AppShell"
import { useAppStore } from "@/store/appStore"
import { isSuspiciousTransaction } from "@/utils/suspicious"

function getStatusClasses(status: string) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (status === "duplicate_blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700"
  }

  return "border-amber-200 bg-amber-50 text-amber-700"
}

function formatStatus(status: string) {
  return status.replace("_", " ")
}

function formatSaveDateTime(isoStr: string) {
  if (!isoStr) return "-"
  try {
    const parts = isoStr.split("T")
    const datePart = parts[0]
    if (parts.length < 2) return datePart

    const timePart = parts[1].split(".")[0]
    const timeParts = timePart.split(":")
    const hours = parseInt(timeParts[0], 10)
    const minutes = timeParts[1]
    const ampm = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${datePart} ${String(displayHours).padStart(2, "0")}:${minutes} ${ampm}`
  } catch {
    return isoStr
  }
}

export default function Transactions() {
  const transactions = useAppStore((state) => state.transactions)
  const currentUser = useAppStore((state) => state.currentUser)
  const exportCsv = useAppStore((state) => state.exportCsv)
  const loadTransactions = useAppStore((state) => state.loadTransactions)
  const deleteTransaction = useAppStore((state) => state.deleteTransaction)
  const updateTransaction = useAppStore((state) => state.updateTransaction)
  const isDataLoading = useAppStore((state) => state.isDataLoading)

  const [editingTransaction, setEditingTransaction] = useState<typeof transactions[0] | null>(null)
  const [editTransactionId, setEditTransactionId] = useState("")
  const [editSender, setEditSender] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  const visibleRows =
    currentUser?.role === "admin"
      ? transactions
      : transactions.filter((row) => row.uploaderId === currentUser?.id)

  const gridClasses = currentUser?.role === "admin"
    ? "grid grid-cols-[1.15fr_1fr_1.1fr_0.9fr_1fr_0.9fr_1fr_0.8fr] gap-3 items-center"
    : "grid grid-cols-[1.15fr_1fr_1fr_0.9fr_1fr_0.9fr_1fr] gap-3 items-center"

  const handleEditClick = (row: typeof transactions[0]) => {
    setEditingTransaction(row)
    setEditTransactionId(row.transactionId)
    setEditSender(row.sender || "")
    setEditAmount(row.amount)
    setEditError(null)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTransaction) return
    setIsSavingEdit(true)
    setEditError(null)

    const result = await updateTransaction(editingTransaction.id, {
      transactionId: editTransactionId,
      sender: editSender,
      amount: editAmount,
    })

    setIsSavingEdit(false)
    if (result.ok) {
      setEditingTransaction(null)
    } else {
      setEditError(result.message)
    }
  }

  const handleDelete = async (transactionId: string) => {
    if (window.confirm("Are you sure you want to delete this transaction? This action is permanent and cannot be undone.")) {
      const result = await deleteTransaction(transactionId)
      if (!result.ok) {
        alert(result.message)
      }
    }
  }

  const handleExport = () => {
    const csv = exportCsv()
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = "transactioniq-export.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell
      title="Transactions"
      subtitle="Search and review submission history with operator ownership, document names, and export support."
    >
      <section className="rounded-[28px] border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Visible records: {visibleRows.length}
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Role: {currentUser?.role}
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Sorted by latest save
            </div>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-[24px] border border-slate-200 lg:block">
          <div className={`${gridClasses} border-b border-slate-200 bg-slate-50 px-4 py-4 text-xs uppercase tracking-[0.28em] text-slate-500`}>
            <span>Txn ID</span>
            <span>Sender</span>
            <span>Uploader</span>
            <span>Txn Date</span>
            <span>Document</span>
            <span>Amount</span>
            <span>Status</span>
            {currentUser?.role === "admin" && <span>Action</span>}
          </div>

          {visibleRows.map((row) => (
            <div
              key={row.id}
              className={`${gridClasses} border-b border-slate-200 px-4 py-5 text-sm text-slate-700 last:border-b-0`}
            >
              <span className="font-medium text-slate-950 flex items-center">
                {row.transactionId}
                {currentUser?.role === "admin" && isSuspiciousTransaction(row.date) && (
                  <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    Suspicious
                  </span>
                )}
              </span>
              <span className="truncate" title={row.sender}>{row.sender || "-"}</span>
              <div>
                <span>{row.uploaderName}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Saved: {formatSaveDateTime(row.createdAt)}</span>
              </div>
              <div>
                <span>{row.date}</span>
                {row.time && <span className="text-[11px] text-slate-400 block mt-0.5">{row.time}</span>}
              </div>
              <span className="truncate">{row.receiptName}</span>
              <span>{row.amount}</span>
              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(row.status)}`}
              >
                {formatStatus(row.status)}
              </span>
              {currentUser?.role === "admin" && (
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleEditClick(row)}
                    className="text-indigo-600 hover:text-indigo-900 transition font-medium"
                  >
                    Edit
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row.id)}
                    className="text-rose-600 hover:text-rose-900 transition font-medium"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4 lg:hidden">
          {visibleRows.map((row) => (
            <div
              key={row.id}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950 flex items-center">
                    {row.transactionId}
                    {currentUser?.role === "admin" && isSuspiciousTransaction(row.date) && (
                      <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                        Suspicious
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {row.amount}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(row.status)}`}
                >
                  {formatStatus(row.status)}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p>Sender: {row.sender || "-"}</p>
                <p>Uploader: {row.uploaderName}</p>
                <p>Transaction Date: {row.date} {row.time ? `at ${row.time}` : ""}</p>
                <p>System Save Date: {formatSaveDateTime(row.createdAt)}</p>
                <p>Document: {row.receiptName}</p>
              </div>
              {currentUser?.role === "admin" && (
                <div className="mt-4 border-t border-slate-200 pt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleEditClick(row)}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row.id)}
                    className="text-sm font-semibold text-rose-600 hover:text-rose-800 transition"
                  >
                    Delete Transaction
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {!visibleRows.length && !isDataLoading ? (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No transactions available for this user.
          </div>
        ) : null}
      </section>

      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md px-4 py-6">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl transition-all">
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-xl font-semibold text-slate-950">
                Edit Transaction Details
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Update transaction reference code, sender name, or amount.
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Transaction ID</span>
                <input
                  value={editTransactionId}
                  onChange={(e) => setEditTransactionId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="Enter reference ID"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Sender Name</span>
                <input
                  value={editSender}
                  onChange={(e) => setEditSender(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="Enter sender name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Amount</span>
                <input
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="e.g. Rs. 5,000"
                  required
                />
              </label>

              {editError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {editError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  disabled={isSavingEdit}
                  className="rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-full bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {isSavingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
