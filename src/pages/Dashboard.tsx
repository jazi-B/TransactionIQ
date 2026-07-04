import { useEffect } from "react"

import AppShell from "@/components/AppShell"
import { useAppStore } from "@/store/appStore"

function formatStatus(status: string) {
  return status.replace("_", " ")
}

export default function Dashboard() {
  const dashboardSummary = useAppStore((state) => state.dashboardSummary)
  const activities = useAppStore((state) => state.activities)
  const currentUser = useAppStore((state) => state.currentUser)
  const loadDashboard = useAppStore((state) => state.loadDashboard)
  const isDataLoading = useAppStore((state) => state.isDataLoading)

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

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
  const recentTransactions = (dashboardSummary?.recentTransactions ?? []).slice(0, 3)

  return (
    <AppShell
      title="Admin dashboard"
      subtitle="Track submissions, duplicate prevention, OCR review quality, and operator activity from one production-style workspace."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                Submission distribution
              </h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              Current snapshot
            </div>
          </div>

          <div className="mt-8 grid h-[240px] grid-cols-7 items-end gap-2 sm:h-[320px] sm:gap-3">
            {[46, 72, 54, 89, 63, 104, 81].map((height, index) => (
              <div key={height} className="flex h-full flex-col justify-end gap-3">
                <div
                  className="rounded-t-[20px] bg-[linear-gradient(180deg,#0f172a,#94a3b8)]"
                  style={{ height: `${height}%` }}
                />
                <p className="text-center text-xs text-slate-400">
                  D{index + 1}
                </p>
              </div>
            ))}
          </div>
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
                    <p className="text-sm font-medium text-slate-900">
                      {item.transactionId}
                    </p>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      {formatStatus(item.status)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {item.channel} · {item.amount} · {item.uploaderName}
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
