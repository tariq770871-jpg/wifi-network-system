import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { devicesApi } from '../../services/devices.service'
import { useAuthStore } from '../../hooks/useAuth'
import DeviceFormModal from './DeviceFormModal'
import toast from 'react-hot-toast'
import {
  Router, Plus, Search, Loader2, MapPin, Wifi, WifiOff, Wrench, Radio,
  Pencil, Trash2, Activity, ChevronDown, Inbox, Satellite, ClipboardList, Download,
} from 'lucide-react'
import { downloadCSV } from '../../utils/csv'

const TYPE_LABELS = {
  router: 'راوتر', switch: 'سويتش', access_point: 'نقطة وصول', antenna: 'هوائي', other: 'أخرى',
}
const STATUS_BADGES = {
  online: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  offline: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  maintenance: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
}
const STATUS_LABELS = { online: 'متصل', offline: 'غير متصل', maintenance: 'صيانة' }
const SOURCE_BADGES = {
  gps: { label: 'GPS', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' },
  manual: { label: 'يدوي', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' },
  mikrotik: { label: 'MikroTik', cls: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20' },
}

export default function DevicesPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  // مزامنة التبويبات: الوصول من popup الخريطة يفتح تفاصيل الجهاز مباشرة
  const focusDeviceId = location.state?.focusDeviceId ?? null

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [formTarget, setFormTarget] = useState(null)   // null | 'new' | device
  const [detailsDevice, setDetailsDevice] = useState(null)
  const [testingId, setTestingId] = useState(null)

  const filters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { device_type: typeFilter } : {}),
    ...(sourceFilter ? { coordinate_source: sourceFilter } : {}),
    page,
    limit: 12,
  }), [search, statusFilter, typeFilter, sourceFilter, page])

  const { data, isLoading } = useQuery({
    queryKey: ['devices', filters],
    queryFn: () => devicesApi.list(filters),
    placeholderData: (prev) => prev,
  })

  const devices = Array.isArray(data?.data?.items) ? data.data.items : []
  const pagination = data?.data?.pagination

  // جلب جهاز محدد عند القدوم من خريطة النظام (فتح التفاصيل تلقائياً)
  const { data: focusData } = useQuery({
    queryKey: ['device', focusDeviceId],
    queryFn: () => devicesApi.get(focusDeviceId),
    enabled: focusDeviceId != null,
  })
  useEffect(() => {
    if (focusDeviceId != null && focusData?.data) {
      setDetailsDevice(focusData.data)
      // مسح الحالة حتى لا يعاد الفتح عند كل عودة للصفحة
      navigate('/devices', { replace: true, state: {} })
    }
  }, [focusDeviceId, focusData, navigate])

  // إبطال موحّد: أي تغيير على جهاز ينعكس على كل التبويبات (القائمة + الخريطة + الداشبورد)
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['devices'] })
    queryClient.invalidateQueries({ queryKey: ['devices-map'] })
    queryClient.invalidateQueries({ queryKey: ['map-points'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id) => devicesApi.delete(id),
    onSuccess: () => {
      invalidateAll()
      toast.success('تم حذف الجهاز')
      setDetailsDevice(null)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'تعذر حذف الجهاز'),
  })

  const testMutation = useMutation({
    mutationFn: (id) => devicesApi.testConnection(id),
    onSuccess: (resp) => {
      setTestingId(null)
      invalidateAll() // الحالة (متصل/غير متصل) تنعكس على الخريطة والداشبورد فوراً
      if (resp?.data?.success) {
        toast.success(`الاتصال ناجح${resp.data.ssid ? ` — SSID: ${resp.data.ssid}` : ''}`, { duration: 5000 })
      } else {
        toast.error(`فشل الاتصال: ${resp?.data?.error || 'لا استجابة من الجهاز'}`, { duration: 6000 })
      }
    },
    onError: (err) => {
      setTestingId(null)
      toast.error(err.response?.data?.error || 'تعذر تنفيذ اختبار الاتصال', { duration: 6000 })
    },
  })

  const handleTest = (id) => {
    setTestingId(id)
    testMutation.mutate(id)
  }

  const activeFilters = [statusFilter, typeFilter, sourceFilter].filter(Boolean).length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الأجهزة</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة أجهزة الشبكة وبيانات التركيب والمواقع</p>
        </div>
        <div className="flex items-center gap-2">
          {/* تصدير CSV — للبيانات المعروضة حالياً (كل الأدوار، متاح مع أو بدون الإضافة) */}
          <button
            onClick={() => {
              const ok = downloadCSV(
                `devices-${new Date().toISOString().slice(0, 10)}.csv`,
                devices,
                [
                  { label: 'الاسم', value: (d) => d.name },
                  { label: 'النوع', value: (d) => TYPE_LABELS[d.device_type] || d.device_type },
                  { label: 'الموديل', value: (d) => d.model },
                  { label: 'المصنع', value: (d) => d.manufacturer },
                  { label: 'الرقم التسلسلي', value: (d) => d.serial_number },
                  { label: 'MAC', value: (d) => d.mac_address },
                  { label: 'IP', value: (d) => d.ip_address },
                  { label: 'الحالة', value: (d) => STATUS_LABELS[d.status] || d.status },
                  { label: 'خط العرض', value: (d) => d.location_lat },
                  { label: 'خط الطول', value: (d) => d.location_lng },
                  { label: 'مصدر الإحداثية', value: (d) => SOURCE_BADGES[d.coordinate_source]?.label || d.coordinate_source },
                  { label: 'تاريخ التركيب', value: (d) => d.installed_at },
                ]
              )
              if (ok) toast.success(`تم تصدير ${devices.length} جهاز`)
            }}
            disabled={devices.length === 0}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all"
            aria-label="تصدير الأجهزة CSV"
          >
            <Download size={15} /> تصدير CSV
          </button>
          {isAdmin && (
            <button
              onClick={() => setFormTarget('new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/25 transition-all"
            >
              <Plus size={15} /> إضافة جهاز
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="بحث بالاسم، الموديل، الرقم التسلسلي، MAC أو IP…"
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/60 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all"
            aria-label="بحث في الأجهزة"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} aria-label="تصفية بالحالة"
            className="px-3 py-2.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">كل الحالات</option>
            <option value="online">متصل</option>
            <option value="offline">غير متصل</option>
            <option value="maintenance">صيانة</option>
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} aria-label="تصفية بالنوع"
            className="px-3 py-2.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">كل الأنواع</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }} aria-label="تصفية بمصدر الإحداثية"
            className="px-3 py-2.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">كل مصادر الموقع</option>
            <option value="gps">GPS</option>
            <option value="manual">يدوي</option>
            <option value="mikrotik">MikroTik</option>
          </select>
          {activeFilters > 0 && (
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter(''); setSourceFilter(''); setPage(1) }}
              className="px-3 py-2.5 rounded-xl text-xs font-medium text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
            >
              مسح التصفية ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && devices.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && devices.length === 0 && (
        <div className="card p-12 text-center">
          <Inbox size={36} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">لا توجد أجهزة مطابقة</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {search || activeFilters ? 'جرّب تعديل البحث أو التصفية' : 'ابدأ بإضافة أول جهاز للشبكة'}
          </p>
        </div>
      )}

      {/* Devices grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {devices.map((d, idx) => (
          <div
            key={d.id}
            className="card p-4 hover:shadow-lg transition-all duration-200 cursor-pointer animate-fade-in"
            style={{ animationDelay: `${idx * 0.03}s` }}
            onClick={() => setDetailsDevice(d)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setDetailsDevice(d)}
            aria-label={`تفاصيل الجهاز ${d.name}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-lg text-white shadow-sm flex-shrink-0 ${
                  d.status === 'online' ? 'bg-emerald-500' : d.status === 'maintenance' ? 'bg-amber-500' : 'bg-gray-400'
                }`}>
                  <Router size={17} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{d.name}</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{TYPE_LABELS[d.device_type]}{d.model ? ` · ${d.model}` : ''}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${STATUS_BADGES[d.status]}`}>
                {STATUS_LABELS[d.status]}
              </span>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              {d.ip_address && (
                <div className="flex items-center gap-1.5"><Wifi size={11} /><span className="font-mono" dir="ltr">{d.ip_address}</span></div>
              )}
              {d.mac_address && (
                <div className="flex items-center gap-1.5"><Radio size={11} /><span className="font-mono" dir="ltr">{d.mac_address}</span></div>
              )}
              {d.location_lat != null && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} />
                  <span className="font-mono" dir="ltr">{d.location_lat.toFixed(4)}, {d.location_lng.toFixed(4)}</span>
                  {d.coordinate_source && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${SOURCE_BADGES[d.coordinate_source]?.cls || ''}`}>
                      {SOURCE_BADGES[d.coordinate_source]?.label}
                    </span>
                  )}
                </div>
              )}
              {d.installed_at && (
                <div className="flex items-center gap-1.5"><ClipboardList size={11} /> رُكّب في {new Date(d.installed_at).toLocaleDateString('ar-SA')}</div>
              )}
            </div>

            {/* Quick actions */}
            {isAdmin && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleTest(d.id)}
                  disabled={testingId === d.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-60"
                  title="اختبار اتصال MikroTik الحي"
                >
                  {testingId === d.id ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />} اختبار
                </button>
                <button
                  onClick={() => setFormTarget(d)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Pencil size={12} /> تعديل
                </button>
                <button
                  onClick={() => { if (window.confirm(`حذف الجهاز "${d.name}"؟`)) deleteMutation.mutate(d.id) }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors mr-auto"
                >
                  <Trash2 size={12} /> حذف
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            السابق
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">صفحة {pagination.page} من {pagination.pages} — {pagination.total} جهاز</span>
          <button
            onClick={() => setPage((p) => (pagination && p < pagination.pages ? p + 1 : p))}
            disabled={!pagination || page >= pagination.pages}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            التالي
          </button>
        </div>
      )}

      {/* Add/Edit modal */}
      {formTarget && (
        <DeviceFormModal
          device={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          canEdit={isAdmin}
        />
      )}

      {/* Details drawer */}
      {detailsDevice && (
        <DeviceDetails
          device={detailsDevice}
          onClose={() => setDetailsDevice(null)}
          isAdmin={isAdmin}
          onEdit={() => { setFormTarget(detailsDevice); setDetailsDevice(null) }}
          onTest={() => handleTest(detailsDevice.id)}
          testing={testingId === detailsDevice.id}
          onDelete={() => { if (window.confirm(`حذف الجهاز "${detailsDevice.name}"؟`)) deleteMutation.mutate(detailsDevice.id) }}
        />
      )}
    </div>
  )
}

/** لوحة تفاصيل الجهاز — كل بيانات الجهاز + قراءة الموارد الحية */
function DeviceDetails({ device: d, onClose, isAdmin, onEdit, onTest, testing, onDelete }) {
  const navigate = useNavigate()
  const { data: liveData } = useQuery({
    queryKey: ['device-status', d.id],
    queryFn: () => devicesApi.status(d.id),
    enabled: isAdmin && !!d.is_mikrotik_linked,
    refetchInterval: 30000,
  })
  const live = liveData?.data

  const rows = [
    ['النوع', TYPE_LABELS[d.device_type]],
    ['الموديل', d.model || '—'],
    ['الشركة المصنّعة', d.manufacturer || '—'],
    ['الرقم التسلسلي', d.serial_number || '—'],
    ['عنوان MAC', d.mac_address || '—'],
    ['عنوان IP', d.ip_address || '—'],
    ['الحالة', STATUS_LABELS[d.status]],
    ['تاريخ التركيب', d.installed_at ? new Date(d.installed_at).toLocaleDateString('ar-SA') : '—'],
    ['الفني المركّب', d.installed_by_name || '—'],
    ['مصدر الإحداثية', SOURCE_BADGES[d.coordinate_source]?.label || '—'],
    ['دقة الموقع', d.gps_accuracy != null ? `±${Math.round(d.gps_accuracy)} متر` : '—'],
    ['آخر SSID', d.last_ssid || '—'],
    ['آخر ظهور', d.last_seen ? new Date(d.last_seen).toLocaleString('ar-SA') : '—'],
    ['ملاحظات', d.notes || '—'],
  ]

  return (
    <div className="fixed inset-0 z-[1000] flex" role="dialog" aria-modal="true" aria-label={`تفاصيل ${d.name}`}>
      <div className="absolute inset-0 bg-black/50 modal-backdrop" onClick={onClose} />
      <div className="relative mr-auto h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl overflow-y-auto animate-fade-in">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-gray-900 dark:text-white truncate">{d.name}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-lg font-bold">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status chips */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGES[d.status]}`}>{STATUS_LABELS[d.status]}</span>
            {d.is_mikrotik_linked && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20">
                مرتبط بـ MikroTik
              </span>
            )}
            {d.coordinate_source && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${SOURCE_BADGES[d.coordinate_source]?.cls}`}>
                موقع: {SOURCE_BADGES[d.coordinate_source]?.label}
              </span>
            )}
          </div>

          {/* Live resources (MikroTik) */}
          {isAdmin && d.is_mikrotik_linked && (
            <div className="border border-gray-100 dark:border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">قراءة حية</h3>
                <button
                  onClick={onTest}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />} اختبار الاتصال
                </button>
              </div>
              {live?.resources ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2.5">
                    <div className="text-gray-400">المعالج</div>
                    <div className="font-bold text-gray-800 dark:text-gray-100 mt-0.5">{live.resources.cpu_load ?? '—'}%</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2.5">
                    <div className="text-gray-400">ذاكرة حرة</div>
                    <div className="font-bold text-gray-800 dark:text-gray-100 mt-0.5">{live.resources.free_memory_mb ?? '—'} MB</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-2.5 col-span-2">
                    <div className="text-gray-400">مدة التشغيل</div>
                    <div className="font-bold text-gray-800 dark:text-gray-100 mt-0.5">{live.resources.uptime || '—'}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">لا توجد قراءة حية — جرّب اختبار الاتصال (يتطلب وصولاً لجهاز MikroTik على الشبكة)</p>
              )}
            </div>
          )}

          {/* All fields */}
          <dl className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700/50">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{k}</dt>
                <dd className="text-xs font-medium text-gray-800 dark:text-gray-100 text-left" dir={/[A-F0-9:.]/.test(String(v)) && k !== 'الحالة' ? 'ltr' : undefined}>{v}</dd>
              </div>
            ))}
          </dl>

          {/* Location links */}
          {d.location_lat != null && (
            <div className="space-y-2">
              <button
                onClick={() => navigate('/map-points', { state: { focusDeviceId: d.id } })}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border border-gray-200 dark:border-gray-600"
              >
                <Satellite size={15} /> عرض على خريطة النظام
              </button>
              <a
                href={`https://www.openstreetmap.org/?mlat=${d.location_lat}&mlon=${d.location_lng}#map=17/${d.location_lat}/${d.location_lng}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-200 dark:border-gray-600"
              >
                <MapPin size={15} /> فتح في OpenStreetMap الخارجية
              </a>
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
              <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity">
                <Pencil size={14} /> تعديل
              </button>
              <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-500 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                <Trash2 size={14} /> حذف
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
