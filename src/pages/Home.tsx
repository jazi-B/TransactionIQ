import {
  ArrowRight,
  CheckCircle2,
  ScanSearch,
  ShieldAlert,
} from "lucide-react"
import { Link } from "react-router-dom"

import { featureCards, heroMetrics, workflowSteps } from "@/data/mock"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <div className="mx-auto max-w-[1440px] px-6 py-6 sm:px-10">
        <header className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
              <ScanSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                Transaction IQ
              </p>
              <p className="text-sm text-slate-500">Transaction controls platform</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <a href="#workflow" className="rounded-full px-4 py-2 transition hover:bg-slate-100">
              Workflow
            </a>
            <a href="#modules" className="rounded-full px-4 py-2 transition hover:bg-slate-100">
              Modules
            </a>
            <Link
              to="/login"
              className="rounded-full border border-slate-200 bg-slate-950 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <section className="grid gap-10 py-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              OCR validation, duplicate prevention, operator accountability
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl">
              A professional control layer for screenshot-based transaction submissions.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Upload payment proofs, invoices, receipts, and transfer slips,
              extract transaction details, review the extracted fields, and
              block duplicate identifiers before they enter the record.
              Transaction IQ is designed for finance operations handling
              high-volume staff submissions across multiple payment channels.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open secure workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Review workflow access
              </Link>
            </div>
          </div>

          <div className="rounded-[36px] border border-slate-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                    Automated review
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                    Submission review card
                  </h2>
                </div>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  Ready for submission
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Transaction ID</span>
                    <span className="font-medium text-slate-950">Detected automatically</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-[92%] rounded-full bg-slate-950" />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Extraction result ready for operator review before save.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      Detection
                    </p>
                    <p className="mt-3 text-lg font-medium text-slate-950">
                      Invoice or payment proof
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Key identifiers, date, time, amount, and parties extracted for review.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-700">
                      Policy
                    </p>
                    <p className="mt-3 text-lg font-medium text-slate-950">
                      Block duplicate save
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-800/80">
                      System cross-checks database before allowing submission.
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-500" />
                    <div>
                      <p className="font-medium">If transaction ID already exists</p>
                      <p className="mt-2 leading-6 text-rose-700">
                        Save is denied and finance receives an alert to review the duplicate attempt.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {heroMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
            >
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-slate-950">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">{metric.detail}</p>
            </div>
          ))}
        </section>

        <section id="modules" className="py-20">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Core modules
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-slate-950">
              Built for controlled financial operations instead of placeholder marketing screens.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[30px] border border-slate-200 bg-white p-6"
              >
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
                  Module
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                  {feature.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="workflow"
          className="grid gap-10 rounded-[36px] border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr]"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Workflow
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-slate-950">
              From screenshot to secure archive in five controlled steps.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">
              The intake journey is designed to preserve operator speed without
              sacrificing data trust.
            </p>
          </div>

          <div className="space-y-4">
            {workflowSteps.map((step) => (
              <div
                key={step.id}
                className="flex gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                  {step.id}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20">
          <div className="rounded-[36px] border border-slate-200 bg-slate-950 p-8 text-white sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Production-ready flow
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em]">
                  Start with secure sign-in and move directly into intake, review, and duplicate prevention.
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Go to sign in
                  <CheckCircle2 className="h-4 w-4" />
                </Link>
                <Link
                  to="/upload"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Open upload screen
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
