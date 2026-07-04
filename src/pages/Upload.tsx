import { useState, type ChangeEvent } from "react"
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react"

import AppShell from "@/components/AppShell"
import { useAppStore } from "@/store/appStore"

export default function Upload() {
  const draft = useAppStore((state) => state.draft)
  const updateDraft = useAppStore((state) => state.updateDraft)
  const processUpload = useAppStore((state) => state.processUpload)
  const saveDraft = useAppStore((state) => state.saveDraft)
  const lastDuplicateId = useAppStore((state) => state.lastDuplicateId)
  const resetDraft = useAppStore((state) => state.resetDraft)

  const [message, setMessage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fieldItems = [
    { label: "Transaction ID", field: "transactionId" },
    { label: "Date", field: "date" },
    { label: "Time", field: "time" },
    { label: "Amount", field: "amount" },
    { label: "Sender", field: "sender" },
    { label: "Receiver", field: "receiver" },
  ] as const

  const duplicateDetected = Boolean(lastDuplicateId)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setIsProcessing(true)
    setMessage("Uploading screenshot. Backend is running OCR and duplicate validation.")

    const result = await processUpload(file)

    if ("duplicateId" in result) {
      setMessage(result.message)
      setIsProcessing(false)
      return
    }

    setMessage(result.message)
    setIsProcessing(false)
  }

  const handleSave = async () => {
    const result = await saveDraft()
    if ("message" in result && !result.ok) {
      setMessage(result.message)
      return
    }

    setMessage(`Saved ${result.transaction.transactionId} successfully.`)
  }

  return (
    <AppShell
      title="Upload transaction"
      subtitle="Upload a screenshot and let the backend automatically run OCR and duplicate validation before save."
    >
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Upload zone
            </p>
            <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 sm:p-6">
              <div className="grid min-h-[250px] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-900 text-white">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-slate-950">
                    Add payment screenshot
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                    Screenshot upload hote hi backend automatically OCR aur duplicate
                    check run karega.
                  </p>
                  <label className="mt-6 inline-flex cursor-pointer items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                    Choose screenshot
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFile}
                    />
                  </label>

                  {isProcessing ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Processing screenshot on backend...
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Submission controls
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Channel
                </span>
                <select
                  value={draft.channel}
                  onChange={(event) => updateDraft("channel", event.target.value)}
                  disabled={isProcessing}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="JazzCash">JazzCash</option>
                  <option value="Easypaisa">Easypaisa</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Receipt name
                </span>
                <input
                  value={draft.receiptName}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  placeholder="Auto-filled after upload"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-500" />
              <div>
                <p className="text-sm font-medium text-rose-800">Duplicate policy</p>
                <p className="mt-2 text-sm leading-6 text-rose-700">
                  Agar duplicate mile to frontend turant batata hai:
                  {" "}
                  {duplicateDetected
                    ? '"This transaction has already been submitted."'
                    : "No duplicate detected yet."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                OCR review
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Extracted transaction fields
              </h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
              Editable before save
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {fieldItems.map((item) => (
              <label
                key={item.field}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
              >
                <span className="mb-2 block text-sm text-slate-500">{item.label}</span>
                <input
                  value={draft[item.field]}
                  onChange={(event) => updateDraft(item.field, event.target.value)}
                  disabled={isProcessing}
                  className="w-full border-none bg-transparent p-0 text-lg font-medium text-slate-950 outline-none placeholder:text-slate-300 disabled:text-slate-500"
                  placeholder={`Enter ${item.label.toLowerCase()}`}
                />
              </label>
            ))}
          </div>

          <label className="mt-4 block rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <span className="mb-2 block text-sm text-slate-500">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
              rows={4}
              disabled={isProcessing}
              className="w-full resize-none border-none bg-transparent p-0 text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-300 disabled:text-slate-500"
              placeholder="Optional review notes"
            />
          </label>

          {duplicateDetected ? (
            <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
              This transaction has already been submitted.
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              {message}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void handleSave()
              }}
              disabled={
                isProcessing ||
                !draft.receiptName ||
                !draft.transactionId ||
                duplicateDetected
              }
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Save transaction
            </button>
            <button
              type="button"
              onClick={() => {
                resetDraft()
                setMessage("Draft cleared.")
              }}
              disabled={isProcessing}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed"
            >
              Clear draft
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Working interaction</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Screenshot upload ke baad OCR aur duplicate validation automatic
                chalti hai, phir fields auto-fill hoti hain.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Backend note</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Current phase FastAPI backend aur real API wiring ke saath chal rahi
                hai. OCR abhi simulated processing use karti hai.
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
