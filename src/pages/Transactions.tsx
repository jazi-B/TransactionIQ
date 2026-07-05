import { useEffect } from "react"

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

export default function Transactions() {
  const transactions = useAppStore((state) => state.transactions)
  const currentUser = useAppStore((state) => state.currentUser)
  const exportCsv = useAppStore((state) => state.exportCsv)
  const loadTransactions = useAppStore((state) => state.loadTransactions)
  const deleteTransaction = useAppStore((state) => state.deleteTransaction)
  const isDataLoading = useAppStore((state) => state.isDataLoading)

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  const visibleRows =
    currentUser?.role === "admin"
      ? transactions
      : transactions.filter((row) => row.uploaderId === currentUser?.id)

  const gridClasses = currentUser?.role === "admin"
    ? "grid grid-cols-[1.15fr_1fr_1.1fr_0.9fr_1fr_0.9fr_1fr_0.45fr] gap-3 items-center"
    : "grid grid-cols-[1.15fr_1fr_1fr_0.9fr_1fr_0.9fr_1fr] gap-3 items-center"

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
            <span>Date</span>
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
              <span>{row.uploaderName}</span>
              <span>{row.date}</span>
              <span className="truncate">{row.receiptName}</span>
              <span>{row.amount}</span>
              <span
                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(row.status)}`}
              >
                {formatStatus(row.status)}
              </span>
              {currentUser?.role === "admin" && (
                <button
                  type="button"
                  onClick={() => void handleDelete(row.id)}
                  className="text-rose-600 hover:text-rose-900 transition font-medium"
                >
                  Delete
                </button>
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
                <p>Date: {row.date}</p>
                <p>Document: {row.receiptName}</p>
              </div>
              {currentUser?.role === "admin" && (
                <div className="mt-4 border-t border-slate-200 pt-3 flex justify-end">
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
    </AppShell>
  )
}
