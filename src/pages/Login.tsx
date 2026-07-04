import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { useAppStore } from "@/store/appStore"
import type { LoginScope } from "@/types/app"

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAppStore((state) => state.login)
  const register = useAppStore((state) => state.register)
  const loginError = useAppStore((state) => state.loginError)
  const isAuthLoading = useAppStore((state) => state.isAuthLoading)
  const currentUser = useAppStore((state) => state.currentUser)

  const [mode, setMode] = useState<"signin" | "register">("signin")
  const [scope, setScope] = useState<LoginScope>("admin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const redirectTarget =
    ((location.state as { from?: string } | null)?.from as string | undefined) ||
    (scope === "admin" ? "/dashboard" : "/upload")

  // Auto-redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      navigate(currentUser.role === "admin" ? "/dashboard" : "/upload", { replace: true })
    }
  }, [currentUser, navigate, redirectTarget])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const success =
      mode === "register"
        ? await register({
            name,
            email,
            password,
          })
        : await login(scope, email, password)
    if (success) {
      navigate(redirectTarget, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-4 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1360px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-6 py-8 text-white sm:px-10 sm:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_20%_25%,rgba(148,163,184,0.14),transparent_30%)]" />
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
              <ShieldCheck className="h-4 w-4 text-sky-300" />
              Transaction IQ
            </div>
          </div>

          <div className="relative z-10 my-auto py-12">
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Welcome back to Transaction IQ
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              A secure, role-based portal for enterprise transaction controls. Access your dashboard, review submissions, and manage system resources.
            </p>
          </div>

          <div className="relative z-10 text-xs text-slate-500">
            © {new Date().getFullYear()} Transaction IQ. All rights reserved.
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-12">
          <div className="mx-auto max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
              <LockKeyhole className="h-4 w-4" />
              Secure sign in
            </div>

            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              {mode === "register" ? "Create staff account" : "Welcome back"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {mode === "register"
                ? "Register a staff account to start uploading records immediately."
                : "Select the correct portal before signing in."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              {(["admin", "staff"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setScope(item)
                    if (item === "admin") {
                      setMode("signin")
                    }
                  }}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    scope === item
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item === "admin" ? "Admin portal" : "Staff portal"}
                </button>
              ))}
            </div>

            {scope === "staff" ? (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                {(["signin", "register"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium capitalize transition ${
                      mode === item
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {item === "signin" ? "Sign in" : "Register"}
                  </button>
                ))}
              </div>
            ) : null}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Full name
                  </span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    placeholder="Enter full name"
                    required
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder={scope === "admin" ? "admin@company.com" : "staff@company.com"}
                  required
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
                  required
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
                  ? mode === "register"
                    ? "Creating account..."
                    : "Signing in..."
                  : mode === "register"
                    ? "Create staff account"
                    : scope === "admin"
                      ? "Sign in as admin"
                      : "Sign in as staff"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              {scope === "admin"
                ? "Admin access is reserved for the single system administrator."
                : mode === "register"
                  ? "New registrations create staff accounts only. Admin access remains locked to the primary administrator."
                  : "Staff members can sign in with an existing account or register a new staff account from this page."}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
