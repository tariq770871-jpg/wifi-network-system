import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi } from '../../services/tickets.service'
import { usersApi } from '../../services/users.service'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'

const statusColors = {
  pending: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}
const statusLabels = { pending: 'قيد الانتظار', assigned: 'معين', in_progress: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' }
const priorityLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل' }

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); toast.success('تم تعيين الفني') },
  })

  const tickets = Array.isArray(ticketsRaw?.data) ? ticketsRaw.data : []
  const allUsers = Array.isArray(usersRaw?.data) ? usersRaw.data : []
  const technicians = allUsers.filter(u => u.role === 'technician')

  const filteredTickets = tickets.filter(t =>
    t.title?.toLowerCase().includes(filter.toLowerCase()) ||
    t.customer_name?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">البلاغات</h1>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="بحث..." value={filter} onChange={(e) => setFilter(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary">
          <option value="">كل الحالات</option>
          {Object.entries(statusLabels).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
        </select>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">البلاغ</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">العميل</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">الأولوية</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">الفني</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (<tr><td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">جاري التحميل...</td></tr>) :
            filteredTickets.length === 0 ? (<tr><td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">لا توجد بلاغات</td></tr>) :
            filteredTickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{ticket.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{ticket.customer_address}</div>
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{ticket.customer_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status] || 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {statusLabels[ticket.status] || ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{priorityLabels[ticket.priority] || ticket.priority}</td>
                <td className="px-4 py-3">
                  {ticket.technician_name ? (<span className="text-sm text-gray-900 dark:text-white">{ticket.technician_name}</span>) : (
                    <select onChange={(e) => { if (e.target.value) assignMutation.mutate({ id: ticket.id, technicianId: e.target.value }) }}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">تعيين فني</option>
                      {technicians.map(t => (<option key={t.id} value={t.id}>{t.full_name}</option>))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}