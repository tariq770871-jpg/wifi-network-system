import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { devicesApi } from '../../services/devices.service'
import { useAuthStore } from '../../hooks/useAuth'
import { useSiteStore } from '../../hooks/useSiteStore'
import DeviceFormModal from './DeviceFormModal'
import toast from 'react-hot-toast'
import {
  Router, Plus, Search, Loader2, MapPin, Wifi, WifiOff, Wrench, Radio,
  Pencil, Trash2, Activity, ChevronDown, Inbox, Satellite, ClipboardList, Download, RefreshCw, ExternalLink,
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

// FEATURE: خيارات عرض الأجهزة في تبويب الأجهزة — حسب حالة الاكتشاف من MikroTik
// ('' = كل الأجهزة) | الشغالة (الظاهرة في Neighbors/Winbox) | المنقطعة خلال 24 ساعة | المنقطعة أكثر
const DEVICE_FILTER_OPTIONS = [
  { value: '', label: 'كل الأجهزة' },
  { value: 'active', label: 'الأجهزة الشغالة' },
  { value: 'offline_24h', label: 'المنقطعة خلال 24 ساعة' },
  { value: 'offline_gt_24h', label: 'المنقطعة أكثر من 24 ساعة' },
]
// FEATURE: مصدر اكتشاف الجهاز من الميكروتك — يظهر كشارة على بطاقة الجهاز
// المصدر الوحيد: Neighbors (لا الأكتيف ولا قوة الإشارة ولا ARP/DHCP بطلب صاحب النظام)
const DISCOVERY_BADGES = {
  neighbor: { label: 'Neighbors', cls: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20' },
}

// FEATURE: فتح Winbox — رابط الوصول عن بعد للراوتر من داخل التطبيق
// العنوان: IP أو MAC — الصيغة: winbox://IP أو winbox://المستخدم@IP
// التفعيل بالنقرة الواحدة يتطلب تسجيل معالج winbox:// مرة واحدة على Windows
// (شغّل setup-winbox-link.ps1 المرفق في مجلد النظام مرة واحدة)
const canWinbox = (d) => (d.device_type === 'router' || d.is_mikrotik_linked) && !!(d.ip_address || d.mac_address)
function openWinbox(d) {
  const addr = d.ip_address || d.mac_address
  if (!addr) return
  const user = d.is_mikrotik_linked && d.mikrotik_username ? d.mikrotik_username : null
  window.location.href = `winbox://${user ? `${encodeURIComponent(user)}@` : ''}${addr}`
  // المتصفح لا يخبرنا إن فتح المعالج فعلاً — بعد لحظة ننسخ العنوان كاحتياط للصق اليدوي
  setTimeout(() => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(addr).catch(() => {})
    toast('إذا لم يفتح Winbox تلقائياً: تم نسخ عنوان الاتصال — الصقه في Winbox. للفتح بنقرة واحدة شغّل setup-winbox-link.ps1 في مجلد النظام مرة واحدة.', { duration: 9000 })
  }, 1800)
}

export default function DevicesPage() {
  const { user } = useAuthStore()
  const { selectedSiteId } = useSiteStore()
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
  // FEATURE: فلتر عرض الأجهزة — كل الأجهزة / الشغالة / المنقطعة خلال 24 ساعة / المنقطعة أكثر
  const [deviceFilter, setDeviceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [formTarget, setFormTarget] = useState(null)   // null | 'new' | device
  const [detailsDevice, setDetailsDevice] = useState(null)
  const [testingId, setTestingId] = useState(null)

  const filters = useMemo(() => ({
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { device_type: typeFilter } : {}),
    ...(sourceFilter ? { coordinate_source: sourceFilter } : {}),
    // FEATURE: فلتر عرض الأجهزة (الشغالة / المنقطعة خلال 24 ساعة / المنقطعة أكثر)
    ...(deviceFilter ? { device_filter: deviceFilter } : {}),
    // FEATURE: فلترة الأجهزة حسب الشبكة المختارة من المبدّل
    ...(selectedSiteId !== 'all' ? { site_id: Number(selectedSiteId) } : {}),
    page,
    limit: 12,
  }), [search, statusFilter, typeFilter, sourceFilter, deviceFilter, selectedSiteId, page])

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

  // FEATURE: حالة جلب الأجهزة من MikroTik (آخر مزامنة + الفاصل التلقائي)
  const { data: discData } = useQuery({
    queryKey: ['discovery-status'],
    queryFn: devicesApi.discoveryStatus,
    refetchInterval: 60000,
  })
  const disc = discData?.data

  // FEATURE: زر "جلب أجهزة MikroTik" — يسحب الأجهزة الظاهرة في Neighbors فقط فوراً
  const syncMutation = useMutation({
    mutationFn: devicesApi.discoverySync,
    onSuccess: (resp) => {
      const s = resp?.data || {}
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['discovery-status'] })
      toast.success(
        `تم جلب ${s.seen_count ?? 0} جهاز — جديد: ${s.new_count ?? 0} · تحديث: ${s.updated_count ?? 0} · انقطع: ${s.offline_count ?? 0}`,
        { duration: 6000 }
      )
      if (Array.isArray(s.errors) && s.errors.length > 0) {
        toast.error(`ملاحظات: ${s.errors.slice(0, 2).join(' — ')}`, { duration: 6000 })
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'تعذر جلب الأجهزة من MikroTik', { duration: 6000 }),
  })

  const activeFilters = [statusFilter, typeFilter, sourceFilter, deviceFilter].filter(Boolean).length

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الأجهزة</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة أجهزة الشبكة وبيانات التركيب والمواقع</p>
          {/* FEATURE: معلومات آخر جلب للأجهزة من MikroTik */}
          {disc?.last_sync?.finished_at && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              آخر جلب من MikroTik: {new Date(disc.last_sync.finished_at).toLocaleString('ar-EG')}
              {disc.last_sync.seen_count != null ? ` — ${disc.last_sync.seen_count} جهاز ظاهر` : ''}
              {disc.interval_minutes > 0 ? ` — تلقائي كل ${disc.interval_minutes} دقيقة` : ' — المزامنة التلقائية موقفة'}
            </p>
          )}
          {disc && disc.linked_routers === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              لا يوجد راوتر مرتبط بـ MikroTik — لتظهر الأجهزة تلقائياً: عدّل جهاز الراوتر وفعّل "ربط MikroTik"
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* FEATURE: جلب الأجهزة الآن من كل الراوترات المرتبطة (admin) */}
          {isAdmin && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 shadow-sm shadow-purple-500/25 disabled:opacity-60 transition-all"
              title="يسحب الأجهزة الظاهرة في تبويب Neighbors في Winbox إلى النظام"
            >
              <RefreshCw size={15} className={syncMutation.isPending ? 'animate-spin' : ''} /> جلب أجهزة MikroTik
            </button>
          )}
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
                  // FEATURE: بيانات الاكتشاف من MikroTik في التصدير
                  { label: 'اسم الجهاز على الشبكة', value: (d) => d.hostname },
                  { label: 'مصدر الاكتشاف', value: (d) => DISCOVERY_BADGES[d.discovery_source]?.label || d.discovery_source },
                  { label: 'الواجهة', value: (d) => d.interface_name },
                  { label: 'آخر ظهور', value: (d) => d.last_seen },
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
          {/* FEATURE: فلتر عرض الأجهزة — الطلب الأساسي: الشغالة/الكل/المنقطعة خلال 24/المنقطعة أكثر */}
          <select value={deviceFilter} onChange={(e) => { setDeviceFilter(e.target.value); setPage(1) }} aria-label="عرض الأجهزة حسب الحالة"
            className="px-3 py-2.5 rounded-xl text-xs font-bold border border-purple-200 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-400/40">
            {DEVICE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
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
              onClick={() => { setStatusFilter(''); setTypeFilter(''); setSourceFilter(''); setDeviceFilter(''); setPage(1) }}
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
                  {d.site_name && (
                    <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">{d.site_name}</p>
                  )}
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
              {/* FEATURE: اسم الجهاز على الشبكة + شارة مصدر الاكتشاف */}
              {d.hostname && d.hostname !== d.name && (
                <div className="flex items-center gap-1.5 truncate"><Inbox size={11} /> {d.hostname}</div>
              )}
              {d.discovery_source && (
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${DISCOVERY_BADGES[d.discovery_source]?.cls || ''}`}>
                    {DISCOVERY_BADGES[d.discovery_source]?.label || d.discovery_source}
                  </span>
                </div>
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

            {/* Quick actions — زر Winbox يظهر لكل الأدوار عند توفر عنوان */}
            {(isAdmin || canWinbox(d)) && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {canWinbox(d) && (
                  <button
                    onClick={() => openWinbox(d)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="يفتح Winbox متصلاً بهذا الراوتر (رابط الوصول عن بعد winbox://)"
                  >
                    <ExternalLink size={12} /> Winbox
                  </button>
                )}
                {isAdmin && (
                  <>
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
                  </>
                )}
                {isAdmin && (
                <button
                  onClick={() => { if (window.confirm(`حذف الجهاز "${d.name}"؟`)) deleteMutation.mutate(d.id) }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors mr-auto"
                >
                  <Trash2 size={12} /> حذف
                </button>
                )}
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
    ['الشبكة', d.site_name || '—'],
    ['الموديل', d.model || '—'],
    ['الشركة المصنّعة', d.manufacturer || '—'],
    ['الرقم التسلسلي', d.serial_number || '—'],
    ['عنوان MAC', d.mac_address || '—'],
    ['عنوان IP', d.ip_address || '—'],
    // FEATURE: بيانات الاكتشاف من MikroTik
    ['اسم الجهاز على الشبكة', d.hostname || '—'],
    ['مصدر الاكتشاف', DISCOVERY_BADGES[d.discovery_source]?.label || '—'],
    ['الواجهة', d.interface_name || '—'],
    ['مكتشف عبر الراوتر', d.discovered_from || '—'],
    ['الحالة', STATUS_LABELS[d.status]],
    ['تاريخ التركيب', d.installed_at ? new Date(d.installed_at).toLocaleDateString('ar-SA') : '—'],
    ['الفني المركّب', d.installed_by_name || '—'],
    ['مصدر الإحداثية', SOURCE_BADGES[d.coordinate_source]?.label || '—'],
    ['دقة الموقع', d.gps_accuracy != null ? `±${Math.round(d.gps_accuracy)} متر` : '—'],
    ['آخر SSID', d.last_ssid || '—'],
    ['آخر ظهور', d.last_seen ? new Date(d.last_seen).toLocaleString('ar-EG') : '—'],
    ['آخر تحديث اكتشاف', d.discovery_updated_at ? new Date(d.discovery_updated_at).toLocaleString('ar-EG') : '—'],
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
                مرتبط بـ MikroTik{d.mikrotik_mode === 'ssh' ? ' (SSH)' : ''}
              </span>
            )}
            {d.coordinate_source && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${SOURCE_BADGES[d.coordinate_source]?.cls}`}>
                موقع: {SOURCE_BADGES[d.coordinate_source]?.label}
              </span>
            )}
          </div>

          {/* FEATURE: رابط الوصول عن بعد — فتح Winbox متصلاً بالراوتر (IP أو MAC) */}
          {canWinbox(d) && (
            <button
              onClick={() => openWinbox(d)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-gray-900 dark:bg-gray-700 text-white hover:opacity-90 transition-opacity"
              title="يفتح Winbox متصلاً بهذا الراوتر — رابط winbox:// (يتطلب تسجيل المعالج مرة واحدة عبر setup-winbox-link.ps1)"
            >
              <ExternalLink size={13} /> فتح Winbox {d.ip_address ? `(${d.ip_address})` : `(${d.mac_address})`}
            </button>
          )}

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
