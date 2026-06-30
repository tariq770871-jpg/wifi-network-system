import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../services/reports.service'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, Ticket, TrendingUp, Award } from 'lucide-react'
import StatCard from '../../components/StatCard'

const COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336']

export default function ReportsPage() {
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery('reports-dashboard', reportsApi.getDashboard)
  const { data: techData, isLoading: techLoading } = useQuery('reports-techs', reportsApi.getTechnicians)

  const tickets = dashboardData?.data?.data?.tickets || []
  const technicians = dashboardData?.data?.data?.technicians || {}
  const monthlyTickets = dashboardData?.data?.data?.monthly_tickets || []
  const techPerformance = techData?.data?.data || []

  const pieData = tickets.map(t => ({
    name: t.status,
    value: parseInt(t.count),
    label: {
      pending: 'قيد الانتظار',
      assigned: 'معين',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل',
      cancelled: 'ملغي',
    }[t.status] || t.status
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">التقارير والإحصائيات</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="إجمالي البلاغات" 
          value={tickets.reduce((sum, t) => sum + parseInt(t.count), 0)} 
          icon={Ticket} 
          color="blue" 
        />
        <StatCard 
          title="الفنيين النشطين" 
          value={technicians.active || 0} 
          icon={Users} 
          color="green" 
        />
        <StatCard 
          title="معدل الإنجاز" 
          value={`${techPerformance.length > 0 
            ? Math.round(techPerformance.reduce((sum, t) => sum + (t.completed / t.total_tasks * 100 || 0), 0) / techPerformance.length)
            : 0}%`} 
          icon={TrendingUp} 
          color="purple" 
        />
        <StatCard 
          title="أفضل فني" 
          value={techPerformance.length > 0 
            ? techPerformance.reduce((max, t) => t.completed > max.completed ? t : max, techPerformance[0])?.full_name 
            : '-'} 
          icon={Award} 
          color="orange" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-bold mb-4">البلاغات اليومية (آخر 30 يوم)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTickets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [value, 'عدد البلاغات']}
                labelFormatter={(label) => new Date(label).toLocaleDateString('ar-SA')}
              />
              <Bar dataKey="count" fill="#1976D2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-bold mb-4">توزيع حالات البلاغات</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, pieData.find(d => d.name === name)?.label || name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-sm">{entry.label} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Technicians Performance */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">أداء الفنيين</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الفني</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">إجمالي المهام</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">مكتملة</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">قيد التنفيذ</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">معلقة</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">نسبة الإنجاز</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {techLoading ? (
              <tr><td colSpan={6} className="text-center py-8">جاري التحميل...</td></tr>
            ) : techPerformance.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">لا توجد بيانات</td></tr>
            ) : (
              techPerformance.map((tech) => (
                <tr key={tech.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{tech.full_name}</td>
                  <td className="px-4 py-3">{tech.total_tasks}</td>
                  <td className="px-4 py-3 text-green-600">{tech.completed}</td>
                  <td className="px-4 py-3 text-purple-600">{tech.in_progress}</td>
                  <td className="px-4 py-3 text-orange-600">{tech.pending}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${tech.total_tasks > 0 ? (tech.completed / tech.total_tasks * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {tech.total_tasks > 0 ? Math.round(tech.completed / tech.total_tasks * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
