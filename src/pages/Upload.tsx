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
import { isSuspiciousTransaction } from "@/utils/suspicious"

const SUPPORTED_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MOBILE_OPTIMIZATION_THRESHOLD_BYTES = 500 * 1024
const MAX_IMAGE_DIMENSION = 1200

async function optimizeImageForUpload(file: File) {
  if (!SUPPORTED_UPLOAD_TYPES.has(file.type) || file.size <= MOBILE_OPTIMIZATION_THRESHOLD_BYTES) {
    return file
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error("Image load failed."))
      nextImage.src = objectUrl
    })

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))

    const context = canvas.getContext("2d")
    if (!context) {
      return file
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const optimizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    })

    if (!optimizedBlob || optimizedBlob.size >= file.size) {
      return file
    }

    const normalizedName = file.name.replace(/\.[^.]+$/, "") || "upload"
    return new File([optimizedBlob], `${normalizedName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function Upload() {
  const draft = useAppStore((state) => state.draft)
  const updateDraft = useAppStore((state) => state.updateDraft)
  const processUpload = useAppStore((state) => state.processUpload)
  const saveDraft = useAppStore((state) => state.saveDraft)
  const lastDuplicateId = useAppStore((state) => state.lastDuplicateId)
  const resetDraft = useAppStore((state) => state.resetDraft)
  const currentUser = useAppStore((state) => state.currentUser)

  const [message, setMessage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadSucceeded, setUploadSucceeded] = useState(false)

  const fieldItems = [
    { label: "Reference ID", field: "transactionId" },
    { label: "Date", field: "date" },
    { label: "Time", field: "time" },
    { label: "Amount", field: "amount" },
    { label: "Sender", field: "sender" },
    { label: "Receiver", field: "receiver" },
  ] as const

  const duplicateDetected = Boolean(lastDuplicateId)
  const generatedReference = draft.transactionId.startsWith("OCR-")

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) {
      return
    }

    if (!SUPPORTED_UPLOAD_TYPES.has(file.type)) {
      setMessage("Please upload a PNG, JPG, or WEBP screenshot.")
      setUploadSucceeded(false)
      return
    }

    setIsProcessing(true)
    setUploadSucceeded(false)
    setMessage("Uploading file and extracting document details.")

    try {
      const uploadFile = await optimizeImageForUpload(file)
      if (uploadFile !== file) {
        setMessage("Large image detected. Optimizing the screenshot for a more reliable mobile upload.")
      }

      const result = await processUpload(uploadFile)

      if (!result.ok) {
        setMessage(result.message)
        setUploadSucceeded(false)
        return
      }

      const needsManualReview =
        !result.draft.transactionId ||
        result.draft.transactionId.startsWith("OCR-") ||
        !result.draft.amount ||
        !result.draft.sender ||
        !result.draft.receiver
      setMessage(
        needsManualReview
          ? "Upload processed. Review the extracted fields and replace any generated or missing values before saving."
          : "Upload processed successfully. Review the extracted fields and save the transaction.",
      )
      setUploadSucceeded(true)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await saveDraft()
      if ("message" in result && !result.ok) {
        setMessage(result.message)
        return
      }

      setMessage(`Transaction ${result.transaction.transactionId} saved successfully.`)
      setUploadSucceeded(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearDraft = () => {
    resetDraft()
    setMessage(null)
    setUploadSucceeded(false)
    setIsProcessing(false)
    setIsSaving(false)
  }

  return (
    <AppShell
      title="Upload transaction"
      subtitle="Upload a payment proof and let the backend automatically run extraction and duplicate validation before save."
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
                    Add payment proof
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                    Upload a receipt or invoice screenshot. The backend automatically
                    extracts details and checks for duplicates.
                  </p>
                  <label className="mt-6 inline-flex cursor-pointer items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                    Choose file
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleFile}
                    />
                  </label>

                  {isProcessing ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Processing upload on backend...
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Document details
            </p>
            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Uploaded file
                </span>
                <input
                  value={draft.receiptName}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  placeholder="Auto-filled after upload"
                />
              </label>

              <div
                className={`rounded-[24px] border px-4 py-4 text-sm ${
                  uploadSucceeded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  {uploadSucceeded ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-5 w-5 text-slate-400" />
                  )}
                  <div>
                    <p className="font-medium">
                      {uploadSucceeded ? "Document processed" : "Awaiting upload"}
                    </p>
                    <p className="mt-2 leading-6">
                      {uploadSucceeded
                        ? "The file has been accepted and the extracted fields are ready for review."
                        : "Upload a document to start OCR extraction and duplicate validation."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-500" />
              <div>
                <p className="text-sm font-medium text-rose-800">Duplicate policy</p>
                <p className="mt-2 text-sm leading-6 text-rose-700">
                  If a duplicate is found, the system shows:
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
                Extracted document fields
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
                  disabled={isProcessing || (item.field === "transactionId" && currentUser?.role === "staff")}
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

          {draft.date && isSuspiciousTransaction(draft.date) ? (
            <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">⚠️ Suspicious Transaction Alert</p>
                <p className="mt-1 leading-6">
                  This transaction date is older than 5 days. Saving this record will automatically flag it as a <strong>Suspicious Transaction</strong> for administrative review.
                </p>
              </div>
            </div>
          ) : null}

          {generatedReference ? (
            <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              OCR could not confirm a reliable reference ID. Enter the correct reference before saving.
            </div>
          ) : null}

          {draft.receiptName && !draft.sender?.trim() ? (
            <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Please enter the sender name in the field.
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
                isSaving ||
                !draft.receiptName ||
                !draft.transactionId ||
                !draft.sender?.trim() ||
                generatedReference ||
                duplicateDetected
              }
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "Saving..." : "Save transaction"}
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
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
                The upload starts OCR and duplicate validation automatically, then
                fills the editable fields for review.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Backend note</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                OCR is connected on the backend. If a field cannot be read with
                confidence, it remains editable so the operator can correct it
                before saving.
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
