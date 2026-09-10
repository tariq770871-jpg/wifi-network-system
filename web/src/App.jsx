import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import LangProvider from './components/LangProvider'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './hooks/useAuth'

// PERFORMANCE: code splitting — كل صفحة bundle مستقل يُحمّل عند الطلب
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'))
const TicketsPage = lazy(() => import('./pages/Tickets/TicketsPage'))
const TrackingPage = lazy(() => import('./pages/Tracking/TrackingPage'))
const MapPointsPage = lazy(() => import('./pages/MapPoints/MapPointsPage'))
const DevicesPage = lazy(() => import('./pages/Devices/DevicesPage'))
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'))
const UsersPage = lazy(() => import('./pages/Users/UsersPage'))

// UX: حالة تحميل موحدة للـ lazy chunks
function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" aria-hidden="true" />
      <p className="mt-4 text-gray-500 text-sm">جارٍ التحميل...</p>
      <span className="sr-only">جارٍ تحميل الصفحة</span>
    </div>
  )
}

function RoleRoute({ roles, children }) {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated || !user) return null
  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <div className="text-8xl font-bold text-gray-200 mb-4">404</div>
      <p className="text-xl text-gray-500 mb-6">الصفحة غير موجودة</p>
      <a href="/" className="text-primary hover:underline">العودة للرئيسية</a>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <Toaster position="top-left" toastOptions={{ duration: 3000 }} />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/tickets" element={<TicketsPage />} />
                {/* الفني يحتاج هذه الصفحة لزر بدء/إيقاف بث GPS — القائمة الحية للفنيين للمدير/الدعم فقط */}
                <Route
                  path="/tracking"
                  element={<RoleRoute roles={['admin', 'support', 'technician']}><TrackingPage /></RoleRoute>}
                />
                <Route path="/map-points" element={<MapPointsPage />} />
                {/* الأجهزة: القراءة لكل الأدوار، الكتابة للمدير فقط (مفروضة في الخلفية) */}
                <Route
                  path="/devices"
                  element={<RoleRoute roles={['admin', 'support', 'technician']}><DevicesPage /></RoleRoute>}
                />
                <Route
                  path="/reports"
                  element={<RoleRoute roles={['admin', 'support']}><ReportsPage /></RoleRoute>}
                />
                <Route
                  path="/users"
                  element={<RoleRoute roles={['admin']}><UsersPage /></RoleRoute>}
                />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </LangProvider>
    </ErrorBoundary>
  )
}
export default App
