import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { LayoutDashboard, Ticket, MapPin, Map, BarChart3, LogOut, Menu, Settings, Users as UsersIcon, X, Sun, Moon } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Bell } from 'lucide-react'
import { socket } from '../services/socketClient'

const THEME_KEY = 'theme'

const allNavItems = [
  { path: '/', label: 'الرئيسية', icon: LayoutDashboard, roles: ['admin','support','technician'] },
  { path: '/tickets', label: 'البلاغات', icon: Ticket, roles: ['admin','support','technician'] },
  { path: '/tracking', label: 'التتبع الحي', icon: MapPin, roles: ['admin','support'] },
  { path: '/map-points', label: 'نقاط الخريطة', icon: Map, roles: ['admin','support','technician'] },
  { path: '/reports', label: 'التقارير', icon: BarChart3, roles: ['admin','support'] },
  { path: '/users', label: 'المستخدمين', icon: UsersIcon, roles: ['admin'] },
  { path: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin','support','technician'] },
]

function getInitialThemeMode() {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved
  return 'light'
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeMode, setThemeMode] = useState(getInitialThemeMode)
  const [notifications, setNotifications] = useState([])
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const queryClient = useQueryClient()
  const userRole = user?.role || 'technician'
  const navItems = allNavItems.filter(item => item.roles.includes(userRole))

  const resolvedTheme = useMemo(() => {
    if (themeMode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeMode
  }, [themeMode])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    localStorage.setItem(THEME_KEY, themeMode)
  }, [resolvedTheme, themeMode])

  useEffect(() => {
    if (themeMode !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setThemeMode(prev => prev) // trigger re-evaluation via resolvedTheme
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  // Listen for theme changes from Settings page
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved && saved !== themeMode) setThemeMode(saved)
    }
    window.addEventListener('theme-change', handler)
    return () => window.removeEventListener('theme-change', handler)
  }, [themeMode])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = (e) => {
      setIsDesktop(e.matches)
      if (e.matches) setSidebarOpen(false)
    }
    setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false)
  }, [isDesktop])

  const toggleTheme = () => {
    setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const addNotification = useCallback((message) => {
    setNotifications(prev => [{ id: Date.now(), text: message, read: false }, ...prev].slice(0, 50))
  }, [])

  // Socket.IO connection
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (!token || !user) {
      socket.disconnect()
      return
    }

    socket.connect()
    socket.emit('join_room', user.role)

    const onTicketCreated = (event) => {
      toast.success(event.message, { position: 'top-left', duration: 4000 })
      addNotification(event.message)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }

    const onTicketUpdated = (event) => {
      toast.success(event.message, { position: 'top-left', duration: 4000 })
      addNotification(event.message)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }

    socket.on('ticket:created', onTicketCreated)
    socket.on('ticket:updated', onTicketUpdated)

    return () => {
      socket.off('ticket:created', onTicketCreated)
      socket.off('ticket:updated', onTicketUpdated)
      socket.disconnect()
    }
  }, [user, queryClient, addNotification])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile hamburger button */}
      {!isDesktop && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 right-3 z-50 p-2 bg-primary text-white rounded-lg shadow-lg hover:bg-primary-dark transition-colors"
        >
          <Menu size={22} />
        </button>
      )}

      {/* Mobile backdrop */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${
        isDesktop
          ? `${sidebarOpen ? 'w-64' : 'w-16'} relative`
          : `fixed top-0 right-0 h-full w-64 z-50 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`
      } bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold text-primary">WiFi Manager</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            {isDesktop ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path}
                onClick={() => !isDesktop && setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive?'bg-primary text-white':'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                <Icon size={20}/>{sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
          {/* Notification bell - desktop only when sidebar collapsed */}
          {isDesktop && !sidebarOpen && (
            <div className="relative">
              <button
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="flex items-center justify-center w-full px-3 py-2 rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="relative">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </div>
              </button>
              {showNotifPanel && (
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-50 text-right">
                  <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">الإشعارات</h3>
                    {unreadCount > 0 && (
                      <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} className="text-xs text-primary hover:underline">تعيين الكل كمقروء</button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 p-4 text-center">لا توجد إشعارات</p>
                    ) : (
                      notifications.slice(0, 20).map(n => (
                        <div key={n.id} className={`p-2 text-xs border-b border-gray-100 dark:border-gray-700 last:border-0 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                          {n.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full"
          >
            {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {sidebarOpen && <span>{resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>}
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">{user?.full_name?.[0]||'U'}</div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-900 dark:text-white">{user?.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{userRole==='admin'?'مدير النظام':userRole==='support'?'دعم فني':'فني'}</p>
              </div>
            )}
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 w-full px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30">
            <LogOut size={18}/>{sidebarOpen && <span>{'تسجيل الخروج'}</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><div className="p-4 md:p-6"><Outlet/></div></main>
    </div>
  )
}