import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { useEffect, useState } from 'react'
import { useT } from '../i18n'

export default function ProtectedRoute() {
  const { isAuthenticated, fetchUser } = useAuthStore()
  const t = useT()
  // null = جارٍ التحقق، true = جلسة صالحة (كوكي)، false = غير مصادق
  const [sessionState, setSessionState] = useState(isAuthenticated ? null : false)

  useEffect(() => {
    let alive = true
    // الكوكي HttpOnly هو مصدر الحقيقة — نستعلم الخادم عند الدخول لأي مسار محمي
    fetchUser().then((user) => {
      if (alive) setSessionState(!!user)
    })
    return () => { alive = false }
  }, [fetchUser])

  if (sessionState === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" aria-hidden="true" />
        <p className="mt-4 text-gray-500 text-sm">{t('common.checkingSession')}</p>
      </div>
    )
  }

  return sessionState ? <Outlet /> : <Navigate to="/login" replace />
}
