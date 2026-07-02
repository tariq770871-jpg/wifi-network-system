import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../services/reports.service'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, Ticket, TrendingUp, Award } from 'lucide-react'
import StatCard from '../../components/StatCard'

const COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336']

const statusLabelMap = {
  pending: 'قيد الانتظار',
  assigned: 'معين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

export default function ReportsPage() {
  const { data: dashRaw, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportsApi.getDashboard,
  })
  const { data: techRaw, isLoading: techLoading } = useQuery({
    queryKey: ['reports-techs'],
    queryFn: reportsApi.getTechnicians,
  })

  // api.js interceptor returns response.data = { success, data: {...} }
  const dashStats = dashRaw?.data || {}
  const tickets = dashStats.tickets || []
  const technicians = dashStats.technicians || {}
  const monthlyTickets = dashStats.monthly_tickets || []
  const techPerformance = Array.isArray(techRaw?.data) ? techRaw.data : []

  const totalTickets = tickets.reduce((sum, t) => sum + parseInt(t.count || 0), 0)
  const pieData = tickets.map(t => ({
    name: t.status,
    value: parseInt(t.count || 0),
    label: statusLabelMap[t.status] || t.status,
  }))

  const avgPerformance = techPerformance.length > 0
    ? Math.round(techPerformance.reduce((sum, t) => sum + (t.total_tasks > 0 ? (t.completed / t.total_tasks * 100) : 0), 0) / techPerformance.length)
    : 0

  const bestTech = techPerformance.length > 0
    ? techPerformance.reduce((max, t) => (t.completed || 0) > (max.completed || 0) ? t : max, techPerformance[0])
    : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">التقارير والإحصائيات</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="إجمالي البلاغات" value={totalTickets} icon={Ticket} color="blue" />
        <StatCard title="الفنيين النشطين" value={technicians.active || 0} icon={Users} color="green" />
        <StatCard title="معدل الإنجاز" value={`${avgPerformance}%`} icon={TrendingUp} color="purple" />
        <StatCard title="أفضل فني" value={bestTech?.full_name || '-'} icon={Award} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-bold mb-4">البلاغات اليومية (آخر 30 يوم)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTickets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(date) => date ? new Date(date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : ''} />
              <YAxis />
              <Tooltip formatter={(value) => [value, 'عدد البلاغات']} labelFormatter={(label) => label ? new Date(label).toLocaleDateString('ar-SA') : ''} />
              <Bar dataKey="count" fill="#1976D2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-bold mb-4">توزيع حالات البلاغات</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {pieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, pieData.find(d => d.name === name)?.label || name]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">لا توجد بيانات</div>
          )}
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

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b"><h2 className="text-lg font-bold">أداء الفنيين</h2></div>
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
                  <td className="px-4 py-3">{tech.total_tasks || 0}</td>
                  <td className="px-4 py-3 text-green-600">{tech.completed || 0}</td>
                  <td className="px-4 py-3 text-purple-600">{tech.in_progress || 0}</td>
                  <td className="px-4 py-3 text-orange-600">{tech.pending || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(tech.total_tasks || 0) > 0 ? ((tech.completed || 0) / tech.total_tasks * 100) : 0}%` }} />
                      </div>
                      <span className="text-sm font-medium">{(tech.total_tasks || 0) > 0 ? Math.round((tech.completed || 0) / tech.total_tasks * 100) : 0}%</span>
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
