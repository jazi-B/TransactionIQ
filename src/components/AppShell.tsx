import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import {
  Bell,
  LayoutGrid,
  LogOut,
  ReceiptText,
  ShieldCheck,
  UploadCloud,
  UserCircle2,
  Users,
} from "lucide-react"

import { appNavigation } from "@/data/mock"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/appStore"

type AppShellProps = {
  title: string
  subtitle: string
  children: ReactNode
}

const navIcons = {
  Dashboard: LayoutGrid,
  Users,
  Upload: UploadCloud,
  Transactions: ReceiptText,
}

export default function AppShell({
  title,
  subtitle,
  children,
}: AppShellProps) {
  const currentUser = useAppStore((state) => state.currentUser)
  const activities = useAppStore((state) => state.activities)
  const logout = useAppStore((state) => state.logout)
  const navigationItems = appNavigation.filter(
    (item) => !item.roles || (currentUser ? item.roles.includes(currentUser.role) : false),
  )

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1560px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-8 lg:border-b-0 lg:border-r">
          <NavLink
            to="/"
            className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            TransactionIQ
          </NavLink>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Account
            </p>
            <h2 className="mt-4 text-2xl font-semibold">
              {currentUser?.name ?? "Operator"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {currentUser?.department ?? "Finance Control"} ·{" "}
              {currentUser?.role === "admin" ? "Administrator" : "Staff user"}
            </p>
          </div>

          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:block lg:space-y-2">
            {navigationItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex min-w-[150px] items-center justify-between rounded-2xl border px-4 py-3 text-sm transition lg:min-w-0",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900",
                  )
                }
              >
                <span className="inline-flex items-center gap-3">
                  {(() => {
                    const Icon = navIcons[item.label as keyof typeof navIcons] ?? UploadCloud

                    return <Icon className="h-4 w-4" />
                  })()}
                  {item.label}
                </span>
                <span className="text-xs uppercase tracking-[0.24em] opacity-60">
                  Open
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Policy
            </p>
            <p className="mt-3 leading-6">
              Save is blocked if the same transaction ID already exists in the
              archive.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void logout()
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <main className="px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_80px_rgba(15,23,42,0.06)] sm:rounded-[32px] sm:px-8 sm:py-6">
            <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Enterprise operations
                </p>
                <h1 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                  {subtitle}
                </p>
              </div>

              <div className="flex w-full items-center gap-4 self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:w-auto">
                <div className="rounded-full bg-white p-2">
                  <Bell className="h-4 w-4 text-slate-700" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    {activities.length} recent activity items
                  </p>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    live session feed
                  </p>
                </div>
                <UserCircle2 className="h-9 w-9 text-slate-300" />
              </div>
            </header>

            <div className="pt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
