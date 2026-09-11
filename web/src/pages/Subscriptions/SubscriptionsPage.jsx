import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionsApi } from '../../services/subscriptions.service'
import { useAuthStore } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import {
  Search, Plus, Loader2, Users, CalendarClock, AlertTriangle, CircleDollarSign,
  Pencil, Trash2, RefreshCw, Wifi, Phone, Inbox, Download
} from 'lucide-react'
import SubscriptionFormModal from './SubscriptionFormModal'
import EmptyState from '../../components/EmptyState'
import { downloadCSV } from '../../utils/csv'

const statusLabels = { active: 'نشط', expired: 'منتهي', suspended: 'موقوف', cancelled: 'ملغي' }
const planLabels = { basic: 'أساسي', standard: 'قياسي', premium: 'مميز', custom: 'مخصص' }

const statusStyles = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  expired: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  suspended: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  cancelled: 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20',
}

// إبطال موحد — مزامنة الاشتراكات مع الداشبورد
const invalidateSync = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')
const fmtMoney = (v) => (v === null || v === undefined ? '0' : Number(v).toLocaleString('ar', { maximumFractionDigits: 2 }))

// كم يوماً حتى نهاية الاشتراك (لعرض التنبيه)
const daysLeft = (endDate) => {
  if (!endDate) return null
  const diff = new Date(String(endDate).slice(0, 10)) - new Date(new Date().toISOString().slice(0, 10))
  return Math.round(diff / 86400000)
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm ring-1 ring-gray-200/60 dark:ring-gray-700/60 flex items-center gap-3">
      <div className={`rounded-lg p-2.5 ${tones[tone]}`} aria-hidden="true"><Icon size={20} /></div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  )
}

export default function SubscriptionsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [renewing, setRenewing] = useState(null)
  const [renewMonths, setRenewMonths] = useState(1)
  const [deleting, setDeleting] = useState(null)
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canWrite = ['admin', 'support'].includes(user?.role)
  const canDelete = user?.role === 'admin'

  const { data: subsData, isLoading } = useQuery({
    queryKey: ['subscriptions', search, statusFilter],
    queryFn: () => subscriptionsApi.getAll({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
  })
  const items = Array.isArray(subsData?.data?.items) ? subsData.data.items : []
  const total = subsData?.data?.pagination?.total ?? items.length

  // بطاقات الإحصاء من الداشبورد — مصدر واحد للحقائق (مزامنة التبويبات)
  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportsDashboard,
    staleTime: 15_000,
  })
  const stats = dashData?.data?.subscriptions || {}

  async function reportsDashboard() {
    // استيراد مباشر لخدمة التقارير — نفس queryKey المستخدم في الداشبورد
    const { reportsApi } = await import('../../services/reports.service')
    return reportsApi.getDashboard()
  }

  const renewMutation = useMutation({
    mutationFn: ({ id, months }) => subscriptionsApi.renew(id, months),
    onSuccess: () => {
      invalidateSync(queryClient)
      setRenewing(null)
      toast.success('تم تجديد الاشتراك')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'فشل التجديد'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => subscriptionsApi.remove(id),
    onSuccess: () => {
      invalidateSync(queryClient)
      setDeleting(null)
      toast.success('تم حذف الاشتراك')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'فشل الحذف'),
  })

  // تنبيه «ينتهي قريباً» محسوب من القائمة المعروضة (نشط وينتهي خلال 7 أيام)
  const expiringCount = useMemo(
    () => items.filter((s) => s.status === 'active' && daysLeft(s.end_date) !== null && daysLeft(s.end_date) <= 7).length,
    [items]
  )

  return (
    <div className="p-4 sm:p-6 space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الاشتراكات</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة اشتراكات العملاء — {total} اشتراك</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            {/* تصدير CSV — من البيانات المعروضة حالياً (يشمل البحث والتصفية) */}
            <button
              onClick={() => {
                const ok = downloadCSV(
                  `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
                  items,
                  [
                    { label: 'اسم العميل', value: (s) => s.customer_name },
                    { label: 'الهاتف', value: (s) => s.customer_phone },
                    { label: 'العنوان', value: (s) => s.customer_address },
                    { label: 'الخطة', value: (s) => planLabels[s.plan] || s.plan },
                    { label: 'السعر الشهري', value: (s) => s.monthly_price },
                    { label: 'تاريخ البدء', value: (s) => s.start_date },
                    { label: 'تاريخ الانتهاء', value: (s) => s.end_date },
                    { label: 'الحالة', value: (s) => statusLabels[s.status] || s.status },
                    { label: 'الجهاز', value: (s) => s.device_name },
                    { label: 'ملاحظات', value: (s) => s.notes },
                  ]
                )
                if (ok) toast.success(`تم تصدير ${items.length} اشتراك`)
              }}
              disabled={items.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              aria-label="تصدير الاشتراكات CSV"
            >
              <Download size={15} aria-hidden="true" /> تصدير CSV
            </button>
            <button onClick={() => { setEditing(null); setShowModal(true) }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              <Plus size={16} aria-hidden="true" /> إضافة اشتراك
            </button>
          </div>
        )}
      </div>

      {/* بطاقات الإحصاء — تعكس الداشبورد لحظياً */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="نشطة" value={stats.active ?? 0} tone="emerald" />
        <StatCard icon={AlertTriangle} label="منتهية" value={stats.expired ?? 0} tone="red" />
        <StatCard icon={CalendarClock} label="تنتهي خلال 7 أيام" value={stats.expiring_soon ?? 0} tone="amber" />
        <StatCard icon={CircleDollarSign} label="الإيراد الشهري (نشطة)" value={fmtMoney(stats.monthly_revenue)} tone="blue" />
      </div>

      {/* بحث + تصفية */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم العميل أو الهاتف أو العنوان…"
            aria-label="بحث في الاشتراكات"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pr-9 pl-3 text-sm text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="تصفية بالحالة"
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm text-gray-900 dark:text-white"
        >
          <option value="">كل الحالات</option>
          {Object.entries(statusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      {/* القائمة */}
      {isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader2 className="animate-spin text-primary" size={32} aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={search || statusFilter ? 'لا نتائج مطابقة' : 'لا توجد اشتراكات بعد'}
          description={search || statusFilter ? 'جرّب تعديل البحث أو التصفية' : 'أضف أول اشتراك عميل من الزر أعلاه'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((s) => {
            const left = daysLeft(s.end_date)
            const expiringSoon = s.status === 'active' && left !== null && left >= 0 && left <= 7
            return (
              <div key={s.id}
                className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm ring-1 ring-gray-200/60 dark:ring-gray-700/60 space-y-2 ${expiringSoon ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                      <Wifi size={16} className="text-primary shrink-0" aria-hidden="true" />
                      {s.customer_name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      خطة {planLabels[s.plan] || s.plan} · {fmtMoney(s.monthly_price)} شهرياً
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${statusStyles[s.status] || statusStyles.cancelled}`}>
                    {statusLabels[s.status] || s.status}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  {s.customer_phone && (
                    <p className="flex items-center gap-1.5"><Phone size={13} aria-hidden="true" /> <span dir="ltr">{s.customer_phone}</span></p>
                  )}
                  {s.customer_address && <p className="truncate">📍 {s.customer_address}</p>}
                  <p className="flex items-center gap-1.5">
                    <CalendarClock size={13} aria-hidden="true" />
                    من {fmtDate(s.start_date)} إلى {fmtDate(s.end_date)}
                  </p>
                  {s.device_name && <p className="truncate">جهاز: {s.device_name}</p>}
                </div>

                {expiringSoon && (
                  <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 inline-flex items-center gap-1.5">
                    <AlertTriangle size={13} aria-hidden="true" />
                    {left === 0 ? 'ينتهي اليوم!' : `ينتهي خلال ${left} يوم`}
                  </p>
                )}

                {(canWrite || canDelete) && (
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                    {canWrite && (
                      <>
                        <button onClick={() => setRenewing(s)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                          <RefreshCw size={13} aria-hidden="true" /> تجديد
                        </button>
                        <button onClick={() => { setEditing(s); setShowModal(true) }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                          <Pencil size={13} aria-hidden="true" /> تعديل
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeleting(s)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 mr-auto">
                        <Trash2 size={13} aria-hidden="true" /> حذف
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* النوافذ */}
      {showModal && (
        <SubscriptionFormModal
          subscription={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}

      {renewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="تجديد اشتراك">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">تجديد اشتراك — {renewing.customer_name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ينتهي حالياً في {fmtDate(renewing.end_date)} — يُضاف التجديد من تاريخ الانتهاء الحالي (أو اليوم إن كان منتهياً) دون فقدان أيام متبقية.
            </p>
            <div>
              <label htmlFor="renew-months" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">عدد الأشهر</label>
              <select id="renew-months" value={renewMonths} onChange={(e) => setRenewMonths(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white">
                {[1, 2, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRenewing(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">إلغاء</button>
              <button onClick={() => renewMutation.mutate({ id: renewing.id, months: renewMonths })} disabled={renewMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
                {renewMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
                تأكيد التجديد
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="تأكيد حذف اشتراك">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400">حذف اشتراك</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              سيُحذف اشتراك «{deleting.customer_name}» نهائياً. هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">إلغاء</button>
              <button onClick={() => deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                حذف نهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
