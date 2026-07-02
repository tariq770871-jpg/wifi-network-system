import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { LayoutDashboard, Ticket, MapPin, Map, BarChart3, LogOut, Menu, Settings } from 'lucide-react'
import { useState } from 'react'

const allNavItems = [
  { path: '/', label: 'الرئيسية', icon: LayoutDashboard, roles: ['admin','support','technician'] },
  { path: '/tickets', label: 'البلاغات', icon: Ticket, roles: ['admin','support','technician'] },
  { path: '/tracking', label: 'التتبع الحي', icon: MapPin, roles: ['admin','support'] },
  { path: '/map-points', label: 'نقاط الخريطة', icon: Map, roles: ['admin','support','technician'] },
  { path: '/reports', label: 'التقارير', icon: BarChart3, roles: ['admin'] },
  { path: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin','support','technician'] },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const userRole = user?.role || 'technician'
  const navItems = allNavItems.filter(item => item.roles.includes(userRole))

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`${sidebarOpen?'w-64':'w-16'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold text-primary">WiFi Manager</h1>}
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-gray-100 rounded"><Menu size={20}/></button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive?'bg-primary text-white':'text-gray-600 hover:bg-gray-100'}`}>
                <Icon size={20}/>{sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">{user?.full_name?.[0]||'U'}</div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{userRole==='admin'?'مدير النظام':userRole==='support'?'دعم فني':'فني'}</p>
              </div>
            )}
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-red-600 hover:text-red-700 w-full px-3 py-2 rounded-lg hover:bg-red-50">
            <LogOut size={18}/>{sidebarOpen && <span>{'تسجيل الخروج'}</span>}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><div className="p-6"><Outlet/></div></main>
    </div>
  )
}
