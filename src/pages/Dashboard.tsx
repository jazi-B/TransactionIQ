import { useEffect, useMemo } from "react"

import AppShell from "@/components/AppShell"
import { useAppStore } from "@/store/appStore"
import { isSuspiciousTransaction } from "@/utils/suspicious"

function formatStatus(status: string) {
  return status.replace("_", " ")
}

function formatSaveDate(isoStr: string) {
  if (!isoStr) return "-"
  try {
    const parts = isoStr.split("T")
    return parts[0]
  } catch {
    return isoStr
  }
}

export default function Dashboard() {
  const dashboardSummary = useAppStore((state) => state.dashboardSummary)
  const activities = useAppStore((state) => state.activities)
  const currentUser = useAppStore((state) => state.currentUser)
  const loadDashboard = useAppStore((state) => state.loadDashboard)
  const loadTransactions = useAppStore((state) => state.loadTransactions)
  const transactions = useAppStore((state) => state.transactions)
  const isDataLoading = useAppStore((state) => state.isDataLoading)

  useEffect(() => {
    void loadDashboard()
    void loadTransactions()
  }, [loadDashboard, loadTransactions])

  const suspiciousCount = useMemo(() => {
    return transactions.filter((t) => isSuspiciousTransaction(t.date)).length
  }, [transactions])

  const dashboardMetrics = [
    {
      label: "Total transactions",
      value: String(dashboardSummary?.totalTransactions ?? 0),
      change: "live records",
    },
    {
      label: "Today's uploads",
      value: String(dashboardSummary?.todaysUploads ?? 0),
      change: "current business day",
    },
    {
      label: "Duplicates blocked",
      value: String(dashboardSummary?.duplicatesBlocked ?? 0),
      change: "prevented before save",
    },
    {
      label: "Approved records",
      value: String(dashboardSummary?.approvedRecords ?? 0),
      change: "ready for finance review",
    },
  ]

  if (currentUser?.role === "admin") {
    dashboardMetrics.push({
      label: "Suspicious audits",
      value: String(suspiciousCount),
      change: "pending manual review",
    })
  }

  const recentTransactions = (dashboardSummary?.recentTransactions ?? []).slice(0, 3)
  const trendBuckets = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short" })
    const now = new Date()
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now)
      date.setHours(0, 0, 0, 0)
      date.setDate(now.getDate() - (6 - index))
      const key = date.toISOString().slice(0, 10)
      return {
        key,
        label: formatter.format(date),
        count: 0,
      }
    })

    for (const transaction of dashboardSummary?.recentTransactions ?? []) {
      const createdAt = transaction.createdAt.slice(0, 10)
      const bucket = days.find((item) => item.key === createdAt)
      if (bucket) {
        bucket.count += 1
      }
    }

    const maxCount = Math.max(...days.map((item) => item.count), 0)

    return days.map((item) => ({
      ...item,
      height: maxCount > 0 ? Math.max(18, Math.round((item.count / maxCount) * 100)) : 0,
    }))
  }, [dashboardSummary?.recentTransactions])
  const hasTrendData = trendBuckets.some((item) => item.count > 0)

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Track submissions, duplicate prevention, OCR review quality, and operator activity from one production-style workspace."
    >
      <section className={`grid gap-4 md:grid-cols-2 ${dashboardMetrics.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        {dashboardMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[28px] border border-slate-200 bg-slate-50 p-6"
          >
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-slate-950">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{metric.change}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                Processing trend
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Submission activity
              </h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              Last 7 days
            </div>
          </div>

          {hasTrendData ? (
            <div className="mt-8 grid h-[240px] grid-cols-7 items-end gap-2 sm:h-[320px] sm:gap-3">
              {trendBuckets.map((item) => (
                <div key={item.key} className="flex h-full flex-col justify-end gap-3">
                  <div
                    className="rounded-t-[20px] bg-[linear-gradient(180deg,#0f172a,#94a3b8)]"
                    style={{ height: `${item.height}%` }}
                    title={`${item.count} submission${item.count === 1 ? "" : "s"}`}
                  />
                  <p className="text-center text-xs text-slate-400">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Activity bars appear automatically as new submissions are saved.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Logged in as
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
              {currentUser?.name}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {currentUser?.role === "admin"
                ? "Administrator view with access to reporting, monitoring, and transaction review."
                : "Staff view with upload workflow and personal submission visibility."}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Latest records
            </p>
            <div className="mt-5 space-y-3">
              {recentTransactions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900 flex items-center">
                      {item.transactionId}
                      {currentUser?.role === "admin" && isSuspiciousTransaction(item.date) && (
                        <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                          Suspicious
                        </span>
                      )}
                    </p>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      {formatStatus(item.status)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {item.amount} · {item.sender || "-"} · {item.uploaderName}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Txn Date: {item.date} {item.time ? `at ${item.time}` : ""} · Saved: {formatSaveDate(item.createdAt)}
                  </p>
                </div>
              )) ?? null}
              {!recentTransactions.length && !isDataLoading ? (
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No transactions available yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Activity feed
            </p>
            <div className="mt-5 space-y-4">
              {activities.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600"
                >
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
