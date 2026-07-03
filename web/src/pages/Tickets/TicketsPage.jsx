import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi } from '../../services/tickets.service'
import { usersApi } from '../../services/users.service'
import { Search, Filter, Ticket, Inbox, Loader2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

const statusColors = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  assigned: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
  in_progress: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20',
  completed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  cancelled: 'bg-gray-50 text-gray-600 ring-1 ring-gray-500/20 dark:bg-gray-700/50 dark:text-gray-400 dark:ring-gray-600/20',
}
const statusLabels = { pending: 'قيد الانتظار', assigned: 'معين', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' }
const priorityConfig = {
  low: { label: 'منخفض', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700' },
  medium: { label: 'متوسط', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  high: { label: 'عالي', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  urgent: { label: 'عاجل', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
}

export default function TicketsPage() {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const { data: ticketsRaw, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: () => ticketsApi.getAll(statusFilter ? { status: statusFilter } : {}),
  })

  const { data: usersRaw } = useQuery({
    queryKey: ['users-list'],
    queryFn: usersApi.getAll,
  })

  const assignMutation = useMutation({
    mutationFn: ({ id, technicianId }) => ticketsApi.assign(id, technicianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('تم تعيين الفني بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const tickets = Array.isArray(ticketsRaw?.data) ? ticketsRaw.data : []
  const allUsers = Array.isArray(usersRaw?.data) ? usersRaw.data : []
  const technicians = allUsers.filter(u => u.role === 'technician')

  const filteredTickets = tickets.filter(t =>
    t.title?.toLowerCase().includes(filter.toLowerCase()) ||
    t.customer_name?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">البلاغات</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة ومتابعة جميع بلاغات الشبكة</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="بحث بالعنوان أو العميل..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field w-full pr-10 pl-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            !statusFilter
              ? 'gradient-primary text-white shadow-md shadow-primary/20'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
          }`}
        >
          <Filter size={14} />
          الكل
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${!statusFilter ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
            {tickets.length}
          </span>
        </button>
        {Object.entries(statusLabels).map(([key, label]) => {
          const count = tickets.filter(t => t.status === key).length
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                statusFilter === key
                  ? 'gradient-primary text-white shadow-md shadow-primary/20'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${statusFilter === key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-gray-500 dark:text-gray-400">جاري تحميل البلاغات...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
              <Inbox size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">لا توجد بلاغات</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">لم يتم العثور على بلاغات مطابقة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">البلاغ</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">العميل</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الحالة</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الأولوية</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الفني</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {filteredTickets.map((ticket, idx) => (
                  <tr
                    key={ticket.id}
                    className="table-row-hover hover:bg-gray-50/80 dark:hover:bg-gray-700/20 animate-fade-in"
                    style={{ animationDelay: `${idx * 0.03}s` }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Ticket size={14} className="text-gray-400" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">{ticket.title}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{ticket.customer_address || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{ticket.customer_name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${statusColors[ticket.status] || statusColors.cancelled}`}>
                        {statusLabels[ticket.status] || ticket.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${priorityConfig[ticket.priority]?.bg || 'bg-gray-100'} ${priorityConfig[ticket.priority]?.color || 'text-gray-500'}`}>
                        {priorityConfig[ticket.priority]?.label || ticket.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {ticket.technician_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full gradient-primary text-white flex items-center justify-center text-[10px] font-bold">
                            {ticket.technician_name[0]}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{ticket.technician_name}</span>
                        </div>
                      ) : (
                        <select
                          onChange={(e) => { if (e.target.value) assignMutation.mutate({ id: ticket.id, technicianId: e.target.value }); e.target.value = '' }}
                          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
                          defaultValue=""
                        >
                          <option value="" disabled>تعيين فني</option>
                          {technicians.map(t => (<option key={t.id} value={t.id}>{t.full_name}</option>))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}