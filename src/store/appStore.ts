import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { emptyUploadDraft } from "@/data/mock"
import {
  ApiError,
  createManagedUser as createManagedUserRequest,
  deactivateManagedUser as deactivateManagedUserRequest,
  fetchCurrentUser,
  fetchDashboardSummary,
  fetchManagedUsers,
  fetchTransactions,
  loginWithScope,
  processUploadReceipt,
  registerStaffUser,
  resetManagedUserPassword as resetManagedUserPasswordRequest,
  saveTransaction,
  signOut,
  deleteTransaction as deleteTransactionRequest,
  updateTransaction as updateTransactionRequest,
} from "@/services/api"
import type {
  ActivityItem,
  CreateManagedUserPayload,
  DashboardSummary,
  LoginScope,
  ManagedUser,
  RegisterUserPayload,
  Transaction,
  UploadDraft,
  UploadProcessingResult,
  User,
} from "@/types/app"

type SaveDraftResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; message: string; duplicateId?: string }

type AppState = {
  token: string | null
  currentUser: User | null
  transactions: Transaction[]
  managedUsers: ManagedUser[]
  activities: ActivityItem[]
  dashboardSummary: DashboardSummary | null
  draft: UploadDraft
  lastDuplicateId: string | null
  loginError: string | null
  isAuthLoading: boolean
  isDataLoading: boolean
  login: (scope: LoginScope, email: string, password: string) => Promise<boolean>
  register: (payload: RegisterUserPayload) => Promise<boolean>
  bootstrapSession: () => Promise<void>
  logout: () => Promise<void>
  loadTransactions: () => Promise<void>
  loadDashboard: () => Promise<void>
  loadManagedUsers: () => Promise<void>
  createManagedUser: (payload: CreateManagedUserPayload) => Promise<{ ok: boolean; message: string }>
  deactivateManagedUser: (userId: string) => Promise<{ ok: boolean; message: string }>
  resetManagedUserPassword: (
    userId: string,
    password: string,
  ) => Promise<{ ok: boolean; message: string }>
  updateDraft: (field: keyof UploadDraft, value: string) => void
  replaceDraft: (draft: UploadDraft) => void
  resetDraft: () => void
  processUpload: (file: File) => Promise<UploadProcessingResult>
  saveDraft: () => Promise<SaveDraftResult>
  deleteTransaction: (transactionId: string) => Promise<{ ok: boolean; message: string }>
  updateTransaction: (
    id: string,
    payload: { transactionId: string; sender: string; amount: string },
  ) => Promise<{ ok: boolean; message: string }>
  setLastDuplicateId: (duplicateId: string | null) => void
  clearDuplicateFlag: () => void
  exportCsv: () => string
}

function pushActivity(
  activities: ActivityItem[],
  text: string,
  tone: ActivityItem["tone"],
) {
  return [
    {
      id: `activity-${Date.now()}`,
      text,
      tone,
      createdAt: new Date().toISOString(),
    },
    ...activities,
  ].slice(0, 12)
}

function toMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof TypeError) {
    return "Upload failed. Check your connection and try a smaller PNG or JPG screenshot."
  }
  return "Something went wrong. Please try again."
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      token: null,
      currentUser: null,
      transactions: [],
      managedUsers: [],
      activities: [],
      dashboardSummary: null,
      draft: emptyUploadDraft,
      lastDuplicateId: null,
      loginError: null,
      isAuthLoading: false,
      isDataLoading: false,
      login: async (scope, email, password) => {
        set({ isAuthLoading: true, loginError: null })

        try {
          const result = await loginWithScope(scope, email, password)
          set({
            token: result.token,
            currentUser: result.user,
            isAuthLoading: false,
            loginError: null,
          })
          return true
        } catch (error) {
          set({
            isAuthLoading: false,
            loginError: toMessage(error),
          })
          return false
        }
      },
      register: async (payload) => {
        set({ isAuthLoading: true, loginError: null })

        try {
          const result = await registerStaffUser(payload)
          set({
            token: result.token,
            currentUser: result.user,
            isAuthLoading: false,
            loginError: null,
          })
          return true
        } catch (error) {
          set({
            isAuthLoading: false,
            loginError: toMessage(error),
          })
          return false
        }
      },
      bootstrapSession: async () => {
        const token = get().token
        if (!token) {
          return
        }

        try {
          const user = await fetchCurrentUser(token)
          set({ currentUser: user, loginError: null })
        } catch {
          set({
            token: null,
            currentUser: null,
            transactions: [],
            managedUsers: [],
            activities: [],
            dashboardSummary: null,
          })
        }
      },
      logout: async () => {
        const token = get().token
        if (token) {
          try {
            await signOut(token)
          } catch {
            // Ignore logout transport errors and clear local session.
          }
        }

        set({
          token: null,
          currentUser: null,
          transactions: [],
          managedUsers: [],
          activities: [],
          dashboardSummary: null,
          draft: emptyUploadDraft,
          lastDuplicateId: null,
          loginError: null,
        })
      },
      loadTransactions: async () => {
        const token = get().token
        if (!token) {
          return
        }

        set({ isDataLoading: true })
        try {
          const transactions = await fetchTransactions(token)
          set({ transactions, isDataLoading: false })
        } catch {
          set({ isDataLoading: false })
        }
      },
      loadDashboard: async () => {
        const token = get().token
        if (!token || get().currentUser?.role !== "admin") {
          return
        }

        set({ isDataLoading: true })
        try {
          const dashboardSummary = await fetchDashboardSummary(token)
          set({
            dashboardSummary,
            activities: dashboardSummary.activities,
            isDataLoading: false,
          })
        } catch {
          set({ isDataLoading: false })
        }
      },
      loadManagedUsers: async () => {
        const token = get().token
        if (!token || get().currentUser?.role !== "admin") {
          return
        }

        set({ isDataLoading: true })
        try {
          const managedUsers = await fetchManagedUsers(token)
          set({ managedUsers, isDataLoading: false })
        } catch {
          set({ isDataLoading: false })
        }
      },
      createManagedUser: async (payload) => {
        const token = get().token
        if (!token || get().currentUser?.role !== "admin") {
          return { ok: false, message: "Admin access required." }
        }

        try {
          const managedUser = await createManagedUserRequest(token, payload)
          set((state) => ({
            managedUsers: [...state.managedUsers, managedUser].sort((left, right) =>
              left.role === right.role ? left.name.localeCompare(right.name) : left.role === "admin" ? -1 : 1,
            ),
          }))
          return { ok: true, message: "User account created successfully." }
        } catch (error) {
          return { ok: false, message: toMessage(error) }
        }
      },
      deactivateManagedUser: async (userId) => {
        const token = get().token
        if (!token || get().currentUser?.role !== "admin") {
          return { ok: false, message: "Admin access required." }
        }

        try {
          const updatedUser = await deactivateManagedUserRequest(token, userId)
          set((state) => ({
            managedUsers: state.managedUsers.map((item) =>
              item.id === userId ? updatedUser : item,
            ),
          }))
          return { ok: true, message: "User account deactivated." }
        } catch (error) {
          return { ok: false, message: toMessage(error) }
        }
      },
      resetManagedUserPassword: async (userId, password) => {
        const token = get().token
        if (!token || get().currentUser?.role !== "admin") {
          return { ok: false, message: "Admin access required." }
        }

        try {
          const updatedUser = await resetManagedUserPasswordRequest(token, userId, password)
          set((state) => ({
            managedUsers: state.managedUsers.map((item) =>
              item.id === userId ? updatedUser : item,
            ),
          }))
          return { ok: true, message: "Password reset completed." }
        } catch (error) {
          return { ok: false, message: toMessage(error) }
        }
      },
      updateDraft: (field, value) =>
        set((state) => ({
          draft: {
            ...state.draft,
            [field]: value,
          },
          lastDuplicateId:
            field === "transactionId" &&
            state.lastDuplicateId &&
            value.trim().toLowerCase() !== state.lastDuplicateId.trim().toLowerCase()
              ? null
              : state.lastDuplicateId,
        })),
      replaceDraft: (draft) => set({ draft }),
      resetDraft: () => set({ draft: emptyUploadDraft, lastDuplicateId: null }),
      processUpload: async (file) => {
        const token = get().token
        const draft = get().draft
        if (!token) {
          return {
            ok: false,
            draft,
            duplicateId: undefined,
            message: "Authentication required.",
          }
        }

        try {
          const result = await processUploadReceipt(token, file, draft.channel)
          let nextDuplicateId: string | null = null
          if ("duplicateId" in result) {
            nextDuplicateId = result.duplicateId ?? null
          }
          set({
            draft: result.draft,
            lastDuplicateId: nextDuplicateId,
          })
          return result
        } catch (error) {
          return {
            ok: false,
            draft,
            duplicateId: undefined,
            message: toMessage(error),
          }
        }
      },
      saveDraft: async () => {
        const token = get().token
        const currentUser = get().currentUser
        const draft = get().draft

        if (!token || !currentUser) {
          return { ok: false, message: "Authentication required." }
        }

        try {
          const transaction = await saveTransaction(token, draft)
          set((state) => ({
            transactions: [transaction, ...state.transactions],
            activities: pushActivity(
              state.activities,
              `${currentUser.name} submitted ${transaction.transactionId}.`,
              "success",
            ),
            draft: emptyUploadDraft,
            lastDuplicateId: null,
          }))
          return { ok: true, transaction }
        } catch (error) {
          const message = toMessage(error)
          if (error instanceof ApiError && error.status === 409) {
            set({ lastDuplicateId: draft.transactionId })
            return {
              ok: false,
              message,
              duplicateId: draft.transactionId,
            }
          }
          return { ok: false, message }
        }
      },
      deleteTransaction: async (transactionId) => {
        const token = get().token
        const currentUser = get().currentUser
        if (!token || !currentUser || currentUser.role !== "admin") {
          return { ok: false, message: "Admin access required." }
        }

        try {
          await deleteTransactionRequest(token, transactionId)
          set((state) => ({
            transactions: state.transactions.filter(
              (item) => item.id !== transactionId && item.transactionId !== transactionId
            ),
            activities: pushActivity(
              state.activities,
              `${currentUser.name} deleted transaction ${transactionId}.`,
              "warning",
            ),
          }))
          return { ok: true, message: "Transaction deleted successfully." }
        } catch (error) {
          return { ok: false, message: toMessage(error) }
        }
      },
      updateTransaction: async (id, payload) => {
        const token = get().token
        const currentUser = get().currentUser
        if (!token || !currentUser || currentUser.role !== "admin") {
          return { ok: false, message: "Admin access required." }
        }

        try {
          const updatedTransaction = await updateTransactionRequest(token, id, payload)
          set((state) => ({
            transactions: state.transactions.map((item) =>
              item.id === id ? updatedTransaction : item
            ),
            activities: pushActivity(
              state.activities,
              `${currentUser.name} updated transaction ${payload.transactionId}.`,
              "neutral",
            ),
          }))
          return { ok: true, message: "Transaction updated successfully." }
        } catch (error) {
          return { ok: false, message: toMessage(error) }
        }
      },
      setLastDuplicateId: (duplicateId) => set({ lastDuplicateId: duplicateId }),
      clearDuplicateFlag: () => set({ lastDuplicateId: null }),
      exportCsv: () => {
        const rows = get().transactions
        const header = [
          "Transaction ID",
          "Channel",
          "Uploader",
          "Date",
          "Time",
          "Amount",
          "Sender",
          "Status",
          "Document Name",
          "Upload Date",
          "Upload Time"
        ]

        const escapeCsvField = (val: string) => {
          const stringified = String(val ?? "")
          const escaped = stringified.replace(/"/g, '""')
          return `"${escaped}"`
        }

        const cleanAmount = (val: string) => {
          const cleaned = String(val ?? "").replace(/[^0-9.]/g, "")
          return cleaned || "0"
        }

        const body = rows.map((entry) => {
          let uploadDate = "-"
          let uploadTime = "-"
          if (entry.createdAt) {
            try {
              // Supabase returns +00:00 format - pass directly to Date()
              const dateObj = new Date(entry.createdAt)

              if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear()
                const month = String(dateObj.getMonth() + 1).padStart(2, "0")
                const day = String(dateObj.getDate()).padStart(2, "0")
                uploadDate = `${year}-${month}-${day}`

                uploadTime = dateObj.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true
                })
              }
            } catch {}
          }
          return [
            escapeCsvField(entry.transactionId),
            escapeCsvField(entry.channel),
            escapeCsvField(entry.uploaderName),
            escapeCsvField(entry.date),
            escapeCsvField(entry.time),
            escapeCsvField(cleanAmount(entry.amount)),
            escapeCsvField(entry.sender || "-"),
            escapeCsvField(entry.status),
            escapeCsvField(entry.receiptName),
            escapeCsvField(uploadDate),
            escapeCsvField(uploadTime),
          ].join(",")
        })

        const quotedHeader = header.map(h => `"${h}"`).join(",")
        return [quotedHeader, ...body].join("\n")
      },
    }),
    {
      name: "transactioniq-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        currentUser: state.currentUser,
      }),
    },
  ),
)
