import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import TicketsPage from './pages/Tickets/TicketsPage'
import TrackingPage from './pages/Tracking/TrackingPage'
import MapPointsPage from './pages/MapPoints/MapPointsPage'
import ReportsPage from './pages/Reports/ReportsPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <>
      <Toaster position="top-left" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tracking" element={<TrackingPage />} />
            <Route path="/map-points" element={<MapPointsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

export default App
