import { useState } from 'react'
import TicketSiteAssigner from './TicketSiteAssigner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketsApi } from '../../services/tickets.service'
import { usersApi } from '../../services/users.service'
import { sitesApi } from '../../services/sites.service'
import { useAuthStore } from '../../hooks/useAuth'
import { useSiteStore } from '../../hooks/useSiteStore'
import { Search, Filter, Ticket, Inbox, Loader2, UserPlus, UserCheck, Plus, X, Play, CheckCircle2, AlertCircle, Network } from 'lucide-react'
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

// ===== نموذج إضافة بلاغ جديد — للمدير والدعم الفني فقط =====
function NewTicketModal({ technicians, defaultSiteId, onClose }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    // FEATURE: الشبكة تُسبق مختارة تلقائياً إن كان المبدّل أعلى الشاشة على شبكة محددة
    site_id: defaultSiteId && defaultSiteId !== 'all' ? String(defaultSiteId) : '',
  })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  // FEATURE: قائمة الشبكات لنموذج البلاغ
  const { data: sitesRaw } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.getAll() })
  const sites = Array.isArray(sitesRaw?.data?.items) ? sitesRaw.data.items : []

  const createMutation = useMutation({
    mutationFn: (data) => ticketsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم إنشاء البلاغ بنجاح — أصبح مرئياً للفنيين')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء إنشاء البلاغ'),
  })

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('عنوان البلاغ مطلوب')
    if (!form.customer_name.trim()) return toast.error('اسم العميل مطلوب')
    createMutation.mutate({
      ...form,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
      site_id: form.site_id ? Number(form.site_id) : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 modal-backdrop" onClick={onClose} />
      <div className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in-scale" role="dialog" aria-modal="true" aria-label="إضافة بلاغ جديد">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700/50 sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Ticket size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">بلاغ جديد</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">سيظهر فوراً للفنيين للانطلاق للإصلاح</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {/* النموذج */}
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">عنوان البلاغ *</label>
            <input
              type="text" value={form.title} onChange={set('title')}
              placeholder="مثال: انقطاع الإنترنت في منطقة..."
              className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">اسم العميل *</label>
              <input
                type="text" value={form.customer_name} onChange={set('customer_name')}
                placeholder="اسم صاحب البلاغ"
                className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">هاتف العميل</label>
              <input
                type="tel" value={form.customer_phone} onChange={set('customer_phone')}
                placeholder="05xxxxxxxx" dir="ltr"
                className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 text-right"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">عنوان العميل</label>
            <input
              type="text" value={form.customer_address} onChange={set('customer_address')}
              placeholder="المدينة / الحي / وصف الموقع"
              className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">وصف الخلل</label>
            <textarea
              value={form.description} onChange={set('description')} rows={3}
              placeholder="تفاصيل المشكلة كما وردت من العميل..."
              className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">الأولوية</label>
              <select
                value={form.priority} onChange={set('priority')}
                className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
              >
                {Object.entries(priorityConfig).map(([key, p]) => (<option key={key} value={key}>{p.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">تعيين فني (اختياري)</label>
              <select
                value={form.assigned_to} onChange={set('assigned_to')}
                className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
              >
                <option value="">بدون تعيين — لاحقاً</option>
                {technicians.map((t) => (<option key={t.id} value={t.id}>{t.full_name}</option>))}
              </select>
            </div>
          </div>

          {/* FEATURE: اختيار الشبكة — ربط البلاغ بشبكة/موقع محدد */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">الشبكة (اختياري)</label>
            <select
              value={form.site_id} onChange={set('site_id')}
              className="input-field w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
            >
              <option value="">بدون شبكة</option>
              {sites.map((s) => (<option key={s.id} value={String(s.id)}>{s.name}</option>))}
            </select>
          </div>

          {/* أزرار الحفظ */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={createMutation.isPending}
              className="flex-1 gradient-primary text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              إنشاء البلاغ
            </button>
            <button
              type="button" onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TicketsPage() {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  // FEATURE: الشبكة المختارة من المبدّل أعلى الشاشة (all = كل الشبكات)
  const { selectedSiteId } = useSiteStore()

  // الصلاحيات: المدير والدعم الفني يضيفان بلاغاً ويعينان الفنيين — الفني ينفذ بلاغاته
  const role = user?.role
  const canManage = role === 'admin' || role === 'support'
  const isTechnician = role === 'technician'

  // FEATURE: تمرير الشبكة المختارة إلى الخادم للفلترة المركزية
  const siteParams = selectedSiteId !== 'all' ? { site_id: Number(selectedSiteId) } : {}
  const { data: ticketsRaw, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter, selectedSiteId],
    queryFn: () => ticketsApi.getAll({ ...(statusFilter ? { status: statusFilter } : {}), ...siteParams }),
  })

  const { data: usersRaw } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: canManage,
  })

  const assignMutation = useMutation({
    mutationFn: ({ id, technicianId }) => ticketsApi.assign(id, technicianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('تم تعيين الفني بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  // FEATURE: تبنّي البلاغ — الفني يحجز بلاغاً غير معيَّن لأحد فيصبح معيَّناً له
  const claimMutation = useMutation({
    mutationFn: (id) => ticketsApi.claim(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم تبنّي البلاغ — أصبح معيَّناً لك')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const startMutation = useMutation({
    mutationFn: (id) => ticketsApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم بدء العمل على البلاغ')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const completeMutation = useMutation({
    mutationFn: (id) => ticketsApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم إكمال البلاغ — أحسنت!')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  // GET /tickets و GET /users يعيدان { items, pagination } — وليس مصفوفة مباشرة
  const tickets = Array.isArray(ticketsRaw?.data?.items) ? ticketsRaw.data.items : []
  const allUsers = Array.isArray(usersRaw?.data?.items) ? usersRaw.data.items : []
  const technicians = allUsers.filter(u => u.role === 'technician' && u.is_active !== false)

  const filteredTickets = tickets.filter(t =>
    t.title?.toLowerCase().includes(filter.toLowerCase()) ||
    t.customer_name?.toLowerCase().includes(filter.toLowerCase())
  )

  // بلاغات الفني الحالي: زر تبنّي للبلاغات غير المعيَّنة، زر بدء للمعيَّن عليه، وزر إكمال لما هو قيد التنفيذ
  const ticketActions = (ticket) => {
    if (!isTechnician) return null
    // FEATURE: تبنّي البلاغ — بلاغ "قيد الانتظار" بلا فني يظهر له زر تبنّي يحجزه به
    if (ticket.assigned_to == null && ticket.status === 'pending') {
      return (
        <button
          onClick={() => claimMutation.mutate(ticket.id)}
          disabled={claimMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm"
        >
          {claimMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
          تبنّي البلاغ
        </button>
      )
    }
    if (ticket.assigned_to !== user?.id) return null
    if (ticket.status === 'pending' || ticket.status === 'assigned') {
      return (
        <button
          onClick={() => startMutation.mutate(ticket.id)}
          disabled={startMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
        >
          {startMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          بدء العمل
        </button>
      )
    }
    if (ticket.status === 'in_progress') {
      return (
        <button
          onClick={() => completeMutation.mutate(ticket.id)}
          disabled={completeMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {completeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          إكمال
        </button>
      )
    }
    return null
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">البلاغات</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isTechnician ? 'بلاغات الشبكة — تبنَّ أي بلاغ غير معيَّن لتبدأ العمل عليه' : 'إدارة ومتابعة جميع بلاغات الشبكة'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="بحث بالعنوان أو العميل..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field w-full pr-10 pl-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400"
            />
          </div>
          {/* زر إضافة بلاغ — المدير والدعم الفني فقط */}
          {canManage && (
            <button
              onClick={() => setShowNewModal(true)}
              className="gradient-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={17} />
              بلاغ جديد
            </button>
          )}
        </div>
      </div>

      {/* MULTI-NETWORK: أداة ربط البلاغات القديمة بالشبكة المختارة — للأدمن والدعم فقط */}
      {canManage && selectedSiteId !== 'all' && (
        <TicketSiteAssigner />
      )}

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
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">البلاغ</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">العميل</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الحالة</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الأولوية</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">الفني</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {filteredTickets.map((ticket, idx) => {
                  const actions = ticketActions(ticket)
                  return (
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
                            {ticket.description && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 max-w-xs truncate" title={ticket.description}>{ticket.description}</div>
                            )}
                            {ticket.site_name && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                  <Network size={10} />
                                  {ticket.site_name}
                                </span>
                              </div>
                            )}
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
                        ) : canManage ? (
                          <select
                            onChange={(e) => { if (e.target.value) assignMutation.mutate({ id: ticket.id, technicianId: e.target.value }); e.target.value = '' }}
                            className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
                            defaultValue=""
                          >
                            <option value="" disabled>تعيين فني</option>
                            {technicians.map(t => (<option key={t.id} value={t.id}>{t.full_name}</option>))}
                          </select>
                        ) : isTechnician && ticket.status === 'pending' ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 font-medium">
                            <UserCheck size={12} />
                            متاح للتبني
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                            <AlertCircle size={12} />
                            غير معيَّن
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {actions || <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* نافذة إضافة بلاغ */}
      {showNewModal && <NewTicketModal technicians={technicians} defaultSiteId={selectedSiteId} onClose={() => setShowNewModal(false)} />}
    </div>
  )
}
