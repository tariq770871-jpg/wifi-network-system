import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { networksApi } from '../../services/networks.service'
import { useAuthStore } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import {
  Plus, Loader2, Wifi, WifiOff, Pencil, Trash2, Lock, Radar, Inbox, X
} from 'lucide-react'
import EmptyState from '../../components/EmptyState'

const statusLabels = { active: 'نشطة', inactive: 'متوقفة', planned: 'مخططة' }
const statusStyles = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  inactive: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  planned: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20',
}
const securityLabels = { open: 'مفتوحة', wep: 'WEP', wpa: 'WPA', wpa2: 'WPA2', wpa3: 'WPA3' }
const bandLabels = { 2.4: '2.4 جيجاهرتز', 5: '5 جيجاهرتز', 6: '6 جيجاهرتز' }

// إبطال موحد — مزامنة الشبكات مع الداشبورد
const invalidateSync = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['networks'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

function NetworkFormModal({ network, onClose }) {
  const isEdit = Boolean(network?.id)
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => ({
    ssid: network?.ssid || '',
    band: network?.band ?? '2.4',
    channel: network?.channel ?? '',
    frequency_mhz: network?.frequency_mhz ?? '',
    security_type: network?.security_type || 'wpa2',
    status: network?.status || 'active',
    location_lat: network?.location_lat ?? '',
    location_lng: network?.location_lng ?? '',
    notes: network?.notes || '',
  }))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? networksApi.update(network.id, payload) : networksApi.create(payload),
    onSuccess: () => {
      invalidateSync(queryClient)
      toast.success(isEdit ? 'تم تحديث الشبكة' : 'تم إنشاء الشبكة')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء الحفظ'),
  })

  const submit = (e) => {
    e.preventDefault()
    if (!form.ssid.trim()) return toast.error('اسم الشبكة SSID مطلوب')
    const payload = {
      ...form,
      band: Number(form.band),
      channel: form.channel === '' ? null : Number(form.channel),
      frequency_mhz: form.frequency_mhz === '' ? null : Number(form.frequency_mhz),
      location_lat: form.location_lat === '' ? null : Number(form.location_lat),
      location_lng: form.location_lng === '' ? null : Number(form.location_lng),
    }
    saveMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={isEdit ? 'تعديل شبكة' : 'إضافة شبكة'}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{isEdit ? `تعديل شبكة — ${network.ssid}` : 'إضافة شبكة WiFi'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="net-ssid" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الشبكة SSID *</label>
              <input id="net-ssid" value={form.ssid} onChange={set('ssid')} required maxLength={100}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" placeholder="MyWiFi-5G" />
            </div>
            <div>
              <label htmlFor="net-band" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">التردد</label>
              <select id="net-band" value={form.band} onChange={set('band')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white">
                {Object.entries(bandLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="net-channel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">القناة</label>
              <input id="net-channel" type="number" min="1" max="196" value={form.channel} onChange={set('channel')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" placeholder="— اختياري —" />
            </div>
            <div>
              <label htmlFor="net-freq" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">التردد (ميغاهرتز)</label>
              <input id="net-freq" type="number" min="2400" max="7200" value={form.frequency_mhz} onChange={set('frequency_mhz')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" placeholder="— اختياري —" />
            </div>
            <div>
              <label htmlFor="net-sec" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">التشفير</label>
              <select id="net-sec" value={form.security_type} onChange={set('security_type')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white">
                {Object.entries(securityLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="net-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الحالة</label>
              <select id="net-status" value={form.status} onChange={set('status')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white">
                {Object.entries(statusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="net-lat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">خط العرض</label>
              <input id="net-lat" type="number" step="any" min="-90" max="90" value={form.location_lat} onChange={set('location_lat')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" placeholder="— اختياري —" />
            </div>
            <div>
              <label htmlFor="net-lng" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">خط الطول</label>
              <input id="net-lng" type="number" step="any" min="-180" max="180" value={form.location_lng} onChange={set('location_lng')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" placeholder="— اختياري —" />
            </div>
          </div>

          <div>
            <label htmlFor="net-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ملاحظات</label>
            <textarea id="net-notes" value={form.notes} onChange={set('notes')} rows={2} maxLength={2000}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">إلغاء</button>
            <button type="submit" disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Wifi size={16} aria-hidden="true" />}
              {isEdit ? 'حفظ التعديلات' : 'إنشاء الشبكة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NetworksPage() {
  const [bandFilter, setBandFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canWrite = ['admin', 'support'].includes(user?.role)
  const canDelete = user?.role === 'admin'

  const { data: netsData, isLoading } = useQuery({
    queryKey: ['networks', bandFilter, statusFilter],
    queryFn: () => networksApi.getAll({
      ...(bandFilter ? { band: bandFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
  })
  const items = Array.isArray(netsData?.data?.items) ? netsData.data.items : []
  const total = netsData?.data?.pagination?.total ?? items.length

  const deleteMutation = useMutation({
    mutationFn: (id) => networksApi.remove(id),
    onSuccess: () => {
      invalidateSync(queryClient)
      setDeleting(null)
      toast.success('تم حذف الشبكة')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'فشل الحذف'),
  })

  return (
    <div className="p-4 sm:p-6 space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الشبكات</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">شبكات WiFi المكتشفة والمُدارة — {total} شبكة</p>
        </div>
        {canWrite && (
          <button onClick={() => { setEditing(null); setShowModal(true) }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Plus size={16} aria-hidden="true" /> إضافة شبكة
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value)} aria-label="تصفية بالتردد"
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm text-gray-900 dark:text-white">
          <option value="">كل الترددات</option>
          {Object.entries(bandLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="تصفية بالحالة"
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm text-gray-900 dark:text-white">
          <option value="">كل الحالات</option>
          {Object.entries(statusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-live="polite">
          <Loader2 className="animate-spin text-primary" size={32} aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={bandFilter || statusFilter ? 'لا نتائج مطابقة' : 'لا توجد شبكات بعد'}
          description={bandFilter || statusFilter ? 'جرّب تعديل التصفية' : 'أضف أول شبكة WiFi من الزر أعلاه'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((n) => (
            <div key={n.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm ring-1 ring-gray-200/60 dark:ring-gray-700/60 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                    {n.status === 'active' ? <Wifi size={16} className="text-emerald-500 shrink-0" aria-hidden="true" /> : <WifiOff size={16} className="text-gray-400 shrink-0" aria-hidden="true" />}
                    <span dir="ltr">{n.ssid}</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{bandLabels[n.band] || n.band}{n.channel ? ` · قناة ${n.channel}` : ''}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${statusStyles[n.status] || ''}`}>{statusLabels[n.status] || n.status}</span>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Lock size={13} aria-hidden="true" /> {securityLabels[n.security_type] || n.security_type}
                  {n.frequency_mhz ? <span className="text-gray-400"> · {n.frequency_mhz} MHz</span> : null}
                </p>
                {(n.location_lat != null && n.location_lng != null) && (
                  <p className="flex items-center gap-1.5">
                    <Radar size={13} aria-hidden="true" />
                    <span dir="ltr">{Number(n.location_lat).toFixed(4)}, {Number(n.location_lng).toFixed(4)}</span>
                  </p>
                )}
                {n.notes && <p className="truncate text-gray-500">{n.notes}</p>}
              </div>

              {(canWrite || canDelete) && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                  {canWrite && (
                    <button onClick={() => { setEditing(n); setShowModal(true) }}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10">
                      <Pencil size={13} aria-hidden="true" /> تعديل
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setDeleting(n)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 mr-auto">
                      <Trash2 size={13} aria-hidden="true" /> حذف
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <NetworkFormModal network={editing} onClose={() => { setShowModal(false); setEditing(null) }} />}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="تأكيد حذف شبكة">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400">حذف شبكة</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">سيُحذف «{deleting.ssid}» نهائياً. هذا الإجراء لا يمكن التراجع عنه.</p>
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
