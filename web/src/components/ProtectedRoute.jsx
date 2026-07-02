import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { useEffect, useState } from 'react'

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Small delay to ensure Zustand store is hydrated from storage
    const timer = setTimeout(() => setChecked(true), 0)
    return () => clearTimeout(timer)
  }, [])

  if (!checked) {
    return null
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}