import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../services/reports.service'
import StatCard from '../../components/StatCard'
import {
  Ticket,
  Users,
  Activity,
  CheckCircle,
  Clock,
  MapPin,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Wifi
} from 'lucide-react'

export default function DashboardPage() {
  const { data: statsData, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportsApi.getDashboard,
  })

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
          <Wifi size={28} className="text-red-500" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-medium">خطأ في تحميل البيانات</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">تأكد من اتصال السيرفر وحاول مجدداً</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2].map(i => <div key={i} className="h-40 skeleton rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const stats = statsData?.data || {}
  const tickets = stats.tickets || []
  const technicians = stats.technicians || {}

  const pendingCount = tickets.find(t => t.status === 'pending')?.count || 0
  const inProgressCount = tickets.find(t => t.status === 'in_progress')?.count || 0
  const completedCount = tickets.find(t => t.status === 'completed')?.count || 0
  const totalCount = tickets.reduce((sum, t) => sum + parseInt(t.count || 0), 0)

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="gradient-primary rounded-2xl p-6 md:p-8 text-white relative overflow-hidden animate-fade-in">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/4 translate-y-1/4" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-blue-100 mt-1 text-sm md:text-base">مرحباً بك في نظام إدارة شبكات WiFi</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard title="إجمالي البلاغات" value={totalCount} icon={Ticket} color="blue" index={0} />
        <StatCard title="قيد الانتظار" value={pendingCount} icon={Clock} color="orange" index={1} />
        <StatCard title="قيد التنفيذ" value={inProgressCount} icon={Activity} color="purple" index={2} />
        <StatCard title="مكتملة" value={completedCount} icon={CheckCircle} color="green" index={3} />
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Technicians */}
        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="gradient-green p-2.5 rounded-xl text-white">
                <Users size={20} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">الفنيين النشطين</h2>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              <ArrowUpRight size={16} />
              <span>{technicians.active || 0}</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              {technicians.active || 0}
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-sm mb-1.5">
              من أصل {technicians.total || 0} فني
            </span>
          </div>
          <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full gradient-green rounded-full transition-all duration-700"
              style={{ width: `${technicians.total > 0 ? ((technicians.active || 0) / technicians.total * 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Live Tracking */}
        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.28s' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="gradient-blue p-2.5 rounded-xl text-white">
                <MapPin size={20} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">التتبع المباشر</h2>
            </div>
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-sm font-medium">
              <ArrowDownLeft size={16} />
              <span>{technicians.tracking || 0}</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              {technicians.tracking || 0}
            </span>
            <span className="text-gray-400 dark:text-gray-500 text-sm mb-1.5">
              فني يبث موقعه حالياً
            </span>
          </div>
          <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full gradient-blue rounded-full transition-all duration-700"
              style={{ width: `${technicians.total > 0 ? ((technicians.tracking || 0) / technicians.total * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}