import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../services/reports.service'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Users, Ticket, TrendingUp, Award, BarChart3, PieChart as PieIcon, Loader2, Inbox } from 'lucide-react'
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
  })).filter(d => d.value > 0)

  const avgPerformance = techPerformance.length > 0
    ? Math.round(techPerformance.reduce((sum, t) => sum + (t.total_tasks > 0 ? (t.completed / t.total_tasks * 100) : 0), 0) / techPerformance.length)
    : 0

  const bestTech = techPerformance.length > 0
    ? techPerformance.reduce((max, t) => (t.completed || 0) > (max.completed || 0) ? t : max, techPerformance[0])
    : null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التقارير والإحصائيات</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">نظرة شاملة على أداء الفريق والبلاغات</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard title="إجمالي البلاغات" value={totalTickets} icon={Ticket} color="blue" index={0} />
        <StatCard title="الفنيين النشطين" value={technicians.active || 0} icon={Users} color="green" index={1} />
        <StatCard title="معدل الإنجاز" value={`${avgPerformance}%`} icon={TrendingUp} color="purple" index={2} />
        <StatCard title="أفضل فني" value={bestTech?.full_name || '-'} icon={Award} color="orange" index={3} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="gradient-blue p-2 rounded-lg text-white">
              <BarChart3 size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">البلاغات اليومية</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 mr-auto">آخر 30 يوم</span>
          </div>
          {dashLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : monthlyTickets.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center gap-2">
              <Inbox size={32} className="text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد بيانات</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTickets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => date ? new Date(date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : ''}
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip
                  formatter={(value) => [value, 'عدد البلاغات']}
                  labelFormatter={(label) => label ? new Date(label).toLocaleDateString('ar-SA') : ''}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" fill="#1976D2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.28s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="gradient-purple p-2 rounded-lg text-white">
              <PieIcon size={18} />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">توزيع الحالات</h2>
          </div>
          {dashLoading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : pieData.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center gap-2">
              <Inbox size={32} className="text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد بيانات</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, pieData.find(d => d.name === name)?.label || name]}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-2">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {entry.label}
                      <span className="text-gray-400 dark:text-gray-500 mr-1">({entry.value})</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Technicians Performance Table */}
      <div className="card overflow-hidden animate-fade-in" style={{ animationDelay: '0.35s' }}>
        <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">أداء الفنيين</h2>
        </div>
        {techLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-gray-500 dark:text-gray-400">جاري التحميل...</p>
          </div>
        ) : techPerformance.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Inbox size={32} className="text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد بيانات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الفني</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">إجمالي المهام</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">مكتملة</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">قيد التنفيذ</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">معلقة</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">نسبة الإنجاز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {techPerformance.map((tech, idx) => {
                  const pct = (tech.total_tasks || 0) > 0 ? Math.round((tech.completed || 0) / tech.total_tasks * 100) : 0
                  return (
                    <tr key={tech.id} className="table-row-hover hover:bg-gray-50/80 dark:hover:bg-gray-700/20 animate-fade-in" style={{ animationDelay: `${idx * 0.04}s` }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg gradient-primary text-white flex items-center justify-center text-xs font-bold">
                            {tech.full_name?.[0] || 'U'}
                          </div>
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{tech.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{tech.total_tasks || 0}</td>
                      <td className="px-5 py-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">{tech.completed || 0}</td>
                      <td className="px-5 py-4 text-sm font-medium text-purple-600 dark:text-purple-400">{tech.in_progress || 0}</td>
                      <td className="px-5 py-4 text-sm font-medium text-amber-600 dark:text-amber-400">{tech.pending || 0}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'gradient-green' : pct >= 50 ? 'gradient-orange' : 'gradient-red'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[36px] text-left">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}