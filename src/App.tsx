import { useEffect } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import ProtectedRoute from "@/components/ProtectedRoute"
import Dashboard from "@/pages/Dashboard"
import Login from "@/pages/Login"
import Transactions from "@/pages/Transactions"
import Upload from "@/pages/Upload"
import Users from "@/pages/Users"
import { useAppStore } from "@/store/appStore"

export default function App() {
  const bootstrapSession = useAppStore((state) => state.bootstrapSession)

  useEffect(() => {
    void bootstrapSession()
  }, [bootstrapSession])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="admin">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Upload />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRole="admin">
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
