import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi } from '../../services/tickets.service'
import { usersApi } from '../../services/users.service'
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Play,
  CheckCircle,
  UserPlus
} from 'lucide-react'
import toast from 'react-hot-toast'

const statusColors = {
  pending: 'bg-orange-100 text-orange-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
}

const statusLabels = {
  pending: 'قيد الانتظار',
  assigned: 'معين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const priorityLabels = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  urgent: 'عاجل',
}

export default function TicketsPage() {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const { data: ticketsData, isLoading } = useQuery(['tickets', statusFilter], () =>
    ticketsApi.getAll(statusFilter ? { status: statusFilter } : {})
  )

  const { data: usersData } = useQuery('users', usersApi.getAll)

  const createMutation = useMutation(ticketsApi.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('tickets')
      setShowCreate(false)
      toast.success('تم إنشاء البلاغ بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const assignMutation = useMutation(
    ({ id, technicianId }) => ticketsApi.assign(id, technicianId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tickets')
        toast.success('تم تعيين الفني')
      },
    }
  )

  // Fix: بعد تعديل api interceptor
  const tickets = ticketsData?.data || []
  const technicians = (usersData?.data || []).filter(u => u.role === 'technician')

  const filteredTickets = tickets.filter(t =>
    t.title?.toLowerCase().includes(filter.toLowerCase()) ||
    t.customer_name?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">البلاغات</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} />
          بلاغ جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="بحث..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary"
        >
          <option value="">كل الحالات</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">البلاغ</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">العميل</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الأولوية</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الفني</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8">جاري التحميل...</td></tr>
            ) : filteredTickets.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">لا توجد بلاغات</td></tr>
            ) : (
              filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{ticket.title}</div>
                    <div className="text-sm text-gray-500">{ticket.customer_address}</div>
                  </td>
                  <td className="px-4 py-3">{ticket.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                      {statusLabels[ticket.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{priorityLabels[ticket.priority]}</td>
                  <td className="px-4 py-3">
                    {ticket.technician_name ? (
                      <span className="text-sm">{ticket.technician_name}</span>
                    ) : (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            assignMutation.mutate({ id: ticket.id, technicianId: e.target.value })
                          }
                        }}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="">تعيين فني</option>
                        {technicians.map(t => (
                          <option key={t.id} value={t.id}>{t.full_name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded" title="تعديل">
                        <Edit size={16} className="text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded" title="حذف">
                        <Trash2 size={16} className="text-red-500" />
                      </button>
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
