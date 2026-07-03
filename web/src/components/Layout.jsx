import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { LayoutDashboard, Ticket, MapPin, Map, BarChart3, LogOut, Menu, Settings, Users as UsersIcon, X, Sun, Moon } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

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