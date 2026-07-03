import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { LayoutDashboard, Ticket, MapPin, Map, BarChart3, LogOut, Menu, Settings, Users as UsersIcon, X, Sun, Moon, Bell, ChevronLeft, Search } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
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
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
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
    const handler = () => setThemeMode(prev => prev)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved && saved !== themeMode) setThemeMode(saved)
    }
    window.addEventListener('theme-change', handler)
    return () => window.removeEventListener('theme-change', handler)
  }, [themeMode])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e) => {
      setIsDesktop(e.matches)
      if (!e.matches) setMobileOpen(false)
    }
    setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = () => {
    setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const addNotification = useCallback((message) => {
    setNotifications(prev => [{ id: Date.now(), text: message, read: false, time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 50))
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

  const currentPage = allNavItems.find(i => i.path === location.pathname)

  return (
    <div className="flex h-screen bg-surface dark:bg-surface-dark">
      {/* Mobile hamburger */}
      {!isDesktop && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 right-4 z-50 p-2.5 gradient-primary text-white rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Mobile backdrop */}
      {!isDesktop && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 modal-backdrop transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className={`${
        isDesktop
          ? `${sidebarOpen ? 'w-64' : 'w-[72px]'} relative flex-shrink-0`
          : `fixed top-0 right-0 h-full w-72 z-50 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`
      } bg-white dark:bg-gray-800 border-l border-gray-200/80 dark:border-gray-700/50 transition-all duration-300 flex flex-col`}>
        {/* Logo area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-700/50 flex-shrink-0">
          {sidebarOpen || !isDesktop ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-base">WiFi Manager</span>
            </div>
          ) : (
            <div className="mx-auto w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          <button
            onClick={() => isDesktop ? setSidebarOpen(!sidebarOpen) : setMobileOpen(false)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {isDesktop ? <ChevronLeft size={18} className={`transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} /> : <X size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => !isDesktop && setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon size={19} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
                {(sidebarOpen || !isDesktop) && <span>{item.label}</span>}
                {isActive && !sidebarOpen && isDesktop && (
                  <div className="absolute right-0 w-1 h-6 bg-primary rounded-l-full" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700/50 p-3 flex-shrink-0 space-y-1">
          {/* Notification bell (collapsed sidebar) */}
          {isDesktop && !sidebarOpen && (
            <div className="relative">
              <button
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="flex items-center justify-center w-full px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors relative"
              >
                <div className="relative">
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
              </button>
              {showNotifPanel && (
                <div className="absolute bottom-full right-0 mb-2 w-80 card p-0 z-50 animate-fade-in-scale overflow-hidden">
                  <div className="flex items-center justify-between p-3.5 border-b border-gray-100 dark:border-gray-700/50">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">الإشعارات</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        تعيين الكل كمقروء
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-xs text-gray-400 dark:text-gray-500">لا توجد إشعارات</p>
                      </div>
                    ) : (
                      notifications.slice(0, 20).map(n => (
                        <div
                          key={n.id}
                          className={`px-3.5 py-3 text-xs border-b border-gray-50 dark:border-gray-700/30 last:border-0 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${!n.read ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}
                        >
                          <div className="text-gray-700 dark:text-gray-300 leading-relaxed">{n.text}</div>
                          <div className="text-gray-400 dark:text-gray-500 mt-1">{n.time}</div>
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
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 w-full text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white`}
          >
            {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            {(sidebarOpen || !isDesktop) && <span>{resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>}
          </button>

          {/* User info */}
          {sidebarOpen || !isDesktop ? (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/30">
              <div className="w-9 h-9 rounded-lg gradient-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                {user?.full_name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{user?.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userRole === 'admin' ? 'مدير النظام' : userRole === 'support' ? 'دعم فني' : 'فني'}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              className="flex items-center justify-center w-full px-3 py-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={19} />
            </button>
          )}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200/80 dark:border-gray-700/50 flex items-center justify-between px-6 flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {currentPage?.label || 'الرئيسية'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification bell (header) */}
            <div className="relative">
              <button
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="relative p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
                )}
              </button>
              {showNotifPanel && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                  <div className="absolute top-full left-0 mt-2 w-80 card p-0 z-50 animate-fade-in-scale overflow-hidden">
                    <div className="flex items-center justify-between p-3.5 border-b border-gray-100 dark:border-gray-700/50">
                      <div className="flex items-center gap-2">
                        <Bell size={16} className="text-primary" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">الإشعارات</h3>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          قراءة الكل
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                          <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد إشعارات جديدة</p>
                        </div>
                      ) : (
                        notifications.slice(0, 20).map(n => (
                          <div
                            key={n.id}
                            className={`px-3.5 py-3 text-xs border-b border-gray-50 dark:border-gray-700/30 last:border-0 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}
                            onClick={() => setNotifications(prev => prev.map(nn => nn.id === n.id ? { ...nn, read: true } : nn))}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                              <div className="flex-1">
                                <div className="text-gray-700 dark:text-gray-300 leading-relaxed">{n.text}</div>
                                <div className="text-gray-400 dark:text-gray-500 mt-1">{n.time}</div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User avatar (header) */}
            <div className="flex items-center gap-2.5 pr-2 border-r border-gray-200 dark:border-gray-700 mr-1">
              <div className="w-8 h-8 rounded-lg gradient-primary text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {user?.full_name?.[0] || 'U'}
              </div>
              {isDesktop && (
                <div className="hidden xl:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{user?.full_name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {userRole === 'admin' ? 'مدير' : userRole === 'support' ? 'دعم فني' : 'فني'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}