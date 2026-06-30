import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../services/reports.service'
import StatCard from '../../components/StatCard'
import {
  Ticket,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin
} from 'lucide-react'

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useQuery('dashboard', reportsApi.getDashboard)

  if (isError) return <div className="p-8 text-center text-red-500">خطأ في تحميل البيانات. تأكد من اتصال السيرفر.</div>
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const tickets = stats?.data?.tickets || []
  const technicians = stats?.data?.technicians || {}

  const pendingCount = tickets.find(t => t.status === 'pending')?.count || 0
  const inProgressCount = tickets.find(t => t.status === 'in_progress')?.count || 0
  const completedCount = tickets.find(t => t.status === 'completed')?.count || 0
  const totalCount = tickets.reduce((sum, t) => sum + parseInt(t.count), 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">لوحة التحكم</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="إجمالي البلاغات" value={totalCount} icon={Ticket} color="blue" />
        <StatCard title="قيد الانتظار" value={pendingCount} icon={Clock} color="orange" />
        <StatCard title="قيد التنفيذ" value={inProgressCount} icon={Activity} color="purple" />
        <StatCard title="مكتملة" value={completedCount} icon={CheckCircle} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={20} className="text-primary" />
            الفنيين النشطين
          </h2>
          <div className="text-3xl font-bold text-primary">{technicians.active || 0}</div>
          <p className="text-gray-500 text-sm mt-1">من أصل {technicians.total || 0} فني</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            التتبع المفعل
          </h2>
          <div className="text-3xl font-bold text-primary">{technicians.tracking || 0}</div>
          <p className="text-gray-500 text-sm mt-1">فني يبث موقعه حالياً</p>
        </div>
      </div>
    </div>
  )
}
