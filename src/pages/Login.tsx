import { useState, type FormEvent } from "react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { loginPresets } from "@/data/mock"
import { useAppStore } from "@/store/appStore"
import type { LoginScope } from "@/types/app"

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAppStore((state) => state.login)
  const loginError = useAppStore((state) => state.loginError)
  const isAuthLoading = useAppStore((state) => state.isAuthLoading)

  const [scope, setScope] = useState<LoginScope>("admin")
  const [email, setEmail] = useState("admin@transactioniq.local")
  const [password, setPassword] = useState("admin123")

  const redirectTarget =
    ((location.state as { from?: string } | null)?.from as string | undefined) ||
    (scope === "admin" ? "/dashboard" : "/upload")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const success = await login(scope, email, password)
    if (success) {
      navigate(redirectTarget, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-4 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1360px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-6 py-8 text-white sm:px-10 sm:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_20%_25%,rgba(148,163,184,0.14),transparent_30%)]" />
          <div className="relative">
            <Link
              to="/"
              className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100"
            >
              <ShieldCheck className="h-4 w-4 text-sky-300" />
              TransactionIQ
            </Link>

            <p className="mt-8 text-xs uppercase tracking-[0.35em] text-slate-400 sm:mt-10">
              Enterprise transaction controls
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Proper role-based access for admins and staff.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              Admins monitor the whole system. Staff members only upload, review,
              and access their own work. This login layer follows that separation.
            </p>

            <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">Admin portal</p>
                <p className="mt-3 text-xl font-medium text-white">Full visibility</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Dashboard, activity tracking, reports, transactions, and
                  complete system monitoring.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">User portal</p>
                <p className="mt-3 text-xl font-medium text-white">Own work only</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Upload screenshots, review OCR results, and access only
                  personal submission history.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
              <LockKeyhole className="h-4 w-4" />
              Secure sign in
            </div>

            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              Welcome back
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Select the correct portal before signing in.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              {(["admin", "staff"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setScope(item)
                    const preset = loginPresets.find((entry) => entry.role === item)
                    if (preset) {
                      setEmail(preset.email)
                      setPassword(preset.password)
                    }
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    scope === item
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item === "admin" ? "Admin login" : "User login"}
                </button>
              ))}
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder={scope === "admin" ? "admin@transactioniq.local" : "staff@transactioniq.local"}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="••••••••"
                />
              </label>

              {loginError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {loginError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isAuthLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isAuthLoading
                  ? "Signing in..."
                  : scope === "admin"
                    ? "Sign in as admin"
                    : "Sign in as user"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-8 space-y-3">
              {loginPresets.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setScope(user.role)
                    setEmail(user.email)
                    setPassword(user.password)
                  }}
                  className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      {user.role}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
