import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import TicketsPage from './pages/Tickets/TicketsPage'
import TrackingPage from './pages/Tracking/TrackingPage'
import MapPointsPage from './pages/MapPoints/MapPointsPage'
import ReportsPage from './pages/Reports/ReportsPage'
import SettingsPage from './pages/Settings/SettingsPage'
import UsersPage from './pages/Users/UsersPage'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './hooks/useAuth'

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
      <Toaster position="top-left" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route
              path="/tracking"
              element={<RoleRoute roles={['admin', 'support']}><TrackingPage /></RoleRoute>}
            />
            <Route path="/map-points" element={<MapPointsPage />} />
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
    </ErrorBoundary>
  )
}
export default App