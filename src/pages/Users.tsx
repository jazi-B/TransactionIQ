import { useEffect, useState, type FormEvent } from "react"

import AppShell from "@/components/AppShell"
import { useAppStore } from "@/store/appStore"
import type { ManagedUser } from "@/types/app"

export default function Users() {
  const managedUsers = useAppStore((state) => state.managedUsers)
  const loadManagedUsers = useAppStore((state) => state.loadManagedUsers)
  const createManagedUser = useAppStore((state) => state.createManagedUser)
  const deactivateManagedUser = useAppStore((state) => state.deactivateManagedUser)
  const resetManagedUserPassword = useAppStore((state) => state.resetManagedUserPassword)
  const isDataLoading = useAppStore((state) => state.isDataLoading)
  const transactions = useAppStore((state) => state.transactions)
  const loadTransactions = useAppStore((state) => state.loadTransactions)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetDrafts, setResetDrafts] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    void loadManagedUsers()
    void loadTransactions()
  }, [loadManagedUsers, loadTransactions])

  const filteredUsers = managedUsers.filter((user) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q) ||
      user.department.toLowerCase().includes(q)
    )
  })

  const activeUsers = managedUsers.filter((user) => user.isActive)
  const inactiveUsers = managedUsers.filter((user) => !user.isActive)

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    const result = await createManagedUser({
      name,
      email,
      password,
    })

    setMessage(result.message)
    if (result.ok) {
      setName("")
      setEmail("")
      setPassword("")
    }
    setIsSubmitting(false)
  }

  const handleDeactivate = async (userId: string) => {
    setIsSubmitting(true)
    const result = await deactivateManagedUser(userId)
    setMessage(result.message)
    setIsSubmitting(false)
  }

  const handleResetPassword = async (userId: string) => {
    const nextPassword = resetDrafts[userId]?.trim()
    if (!nextPassword) {
      setMessage("New password required before reset.")
      return
    }

    setIsSubmitting(true)
    const result = await resetManagedUserPassword(userId, nextPassword)
    setMessage(result.message)
    if (result.ok) {
      setResetDrafts((state) => ({
        ...state,
        [userId]: "",
      }))
    }
    setIsSubmitting(false)
  }

  const downloadUserReport = (user: ManagedUser) => {
    const userTransactions = transactions.filter(
      (t) => t.uploaderId === user.id || t.uploaderName.toLowerCase() === user.name.toLowerCase()
    )

    const escapeCsvField = (val: string) => {
      const stringified = String(val ?? "")
      const escaped = stringified.replace(/"/g, '""')
      return `"${escaped}"`
    }

    const csvContent = [
      `"User Activity Report"`,
      `"Name",${escapeCsvField(user.name)}`,
      `"Email",${escapeCsvField(user.email)}`,
      `"Role","${user.role}"`,
      `"Status","${user.isActive ? "Active" : "Inactive"}"`,
      `"Total Submissions","${userTransactions.length}"`,
      ``,
      `"Transaction ID","Channel","Date","Time","Amount","Status","Document Name","Upload Date","Upload Time"`
    ]

    userTransactions.forEach((t) => {
      let uploadDate = "-"
      let uploadTime = "-"
      if (t.createdAt) {
        try {
          const parts = t.createdAt.split("T")
          uploadDate = parts[0]
          if (parts.length >= 2) {
            const timePart = parts[1].split(".")[0]
            const timeParts = timePart.split(":")
            const hours = parseInt(timeParts[0], 10)
            const minutes = timeParts[1]
            const ampm = hours >= 12 ? "PM" : "AM"
            const displayHours = hours % 12 || 12
            uploadTime = `${String(displayHours).padStart(2, "0")}:${minutes} ${ampm}`
          }
        } catch {}
      }
      csvContent.push(
        [
          escapeCsvField(t.transactionId),
          escapeCsvField(t.channel),
          escapeCsvField(t.date),
          escapeCsvField(t.time),
          escapeCsvField(t.amount),
          escapeCsvField(t.status),
          escapeCsvField(t.receiptName),
          escapeCsvField(uploadDate),
          escapeCsvField(uploadTime),
        ].join(",")
      )
    })

    const blob = new Blob([csvContent.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `report-${user.name.toLowerCase().replace(/\s+/g, "-")}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell
      title="User management"
      subtitle="Create staff accounts with minimal fields, keep only one admin, and control account status without increasing system complexity."
    >
      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Access policy
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>Only one admin account is allowed in this workspace.</p>
              <p>New accounts are always created as staff users.</p>
              <p>Minimal onboarding keeps usage low: name, email, and password only.</p>
            </div>
          </div>

          <form
            onSubmit={handleCreate}
            autoComplete="off"
            className="rounded-[28px] border border-slate-200 bg-white p-6"
          >
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Create staff user
            </p>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="Enter staff name"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="staff@company.com"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Temporary password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="Enter starting password"
                  required
                />
              </label>
            </div>

            {message ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving user..." : "Create staff account"}
            </button>
          </form>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                User registry
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Active team accounts
              </h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              {activeUsers.length} active · {inactiveUsers.length} inactive
            </div>
          </div>

          <div className="mt-5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              placeholder="Search users by name, email, department or role..."
            />
          </div>

          <div className="mt-6 space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-slate-950">{user.name}</p>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {user.role}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${
                          user.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-200 text-slate-600"
                        }`}
                      >
                        {user.isActive ? "active" : "inactive"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{user.email}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {user.department} · Created {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {user.role === "admin" ? (
                    <div className="flex flex-col gap-3 sm:min-w-[320px]">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 text-center">
                        Single admin account is locked for safety.
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadUserReport(user)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Download Activity Report
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:min-w-[320px]">
                      <input
                        type="password"
                        value={resetDrafts[user.id] ?? ""}
                        onChange={(event) =>
                          setResetDrafts((state) => ({
                            ...state,
                            [user.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        placeholder="Enter new password"
                        disabled={!user.isActive || isSubmitting}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            void handleResetPassword(user.id)
                          }}
                          disabled={!user.isActive || isSubmitting}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeactivate(user.id)
                          }}
                          disabled={!user.isActive || isSubmitting}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          Deactivate user
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadUserReport(user)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Download Activity Report
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!filteredUsers.length && !isDataLoading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {searchQuery.trim() ? "No users match your search query." : "No managed users found yet."}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  )
}
