import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { useAppStore } from "@/store/appStore"
import type { UserRole } from "@/types/app"

type ProtectedRouteProps = {
  children: ReactNode
  allowedRole?: UserRole
}

export default function ProtectedRoute({
  children,
  allowedRole,
}: ProtectedRouteProps) {
  const currentUser = useAppStore((state) => state.currentUser)
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRole && currentUser.role !== allowedRole) {
    return <Navigate to="/upload" replace />
  }

  return children
}
