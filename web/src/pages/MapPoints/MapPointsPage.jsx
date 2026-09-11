import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { mapPointsApi } from '../../services/mapPoints.service'
import { devicesApi } from '../../services/devices.service'
import { useAuthStore } from '../../hooks/useAuth'
import { MapContainer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { Check, X, MapPin, Clock, Loader2, Inbox, Map, Plus, Router, Wifi } from 'lucide-react'
import toast from 'react-hot-toast'
import L from '../../lib/leaflet-setup'
import { LocateControl, LayerToggle } from '../../components/MapControls'

const statusColors = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
}
const statusLabels = { pending: 'بانتظار الموافقة', approved: 'معتمد', rejected: 'مرفوض' }

const TYPE_LABELS = {
  router: 'راوتر', switch: 'سويتش', access_point: 'نقطة وصول', antenna: 'هوائي', other: 'أخرى',
}
const DEVICE_STATUS = {
  online: { label: 'متصل', color: '#10B981' },
  offline: { label: 'غير متصل', color: '#6B7280' },
  maintenance: { label: 'صيانة', color: '#F59E0B' },
}
const SOURCE_LABELS = { gps: 'GPS', manual: 'يدوي', mikrotik: 'MikroTik' }

// رمز WiFi داخل علامة الجهاز (نفس أيقونة الشبكة في الهوية)
const WIFI_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>`

/** علامة الجهاز — لونها يتبع حالة الاتصال */
const deviceIcon = (status) => L.divIcon({
  html: `<div style="width:26px;height:26px;border-radius:8px;background:${DEVICE_STATUS[status]?.color || '#6B7280'};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">${WIFI_SVG}</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: 'device-marker',
})

const pointIcon = (color) => L.divIcon({
  html: `<div style="width:18px;height:18px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px ${color}66;"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
})

const approvedPointIcon = pointIcon('#10B981')
const pendingPointIcon = pointIcon('#F59E0B')

// دبوس أحمر مؤقت لموضع النقطة الجديدة قبل الحفظ
const newPointIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#EF4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(239,68,68,0.5);"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
})

/** يلتقط النقر على الخريطة أثناء وضع الإضافة */
function MapClickCatcher({ active, onSelect }) {
  useMapEvents({
    click: (e) => {
      if (active) onSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

/** علامة جهاز على الخريطة — popup بتفاصيل الجهاز + فتح تبويب الأجهزة، وتحليق تلقائي عند focusDeviceId */
function DeviceMarker({ device: d, focused }) {
  const map = useMap()
  const markerRef = useRef(null)

  useEffect(() => {
    if (focused && markerRef.current) {
      map.flyTo([d.location_lat, d.location_lng], Math.max(map.getZoom(), 16), { duration: 1 })
      setTimeout(() => markerRef.current?.openPopup(), 1050)
    }
  }, [focused, map, d])

  const st = DEVICE_STATUS[d.status] || DEVICE_STATUS.offline
  return (
    <Marker
      position={[d.location_lat, d.location_lng]}
      icon={deviceIcon(d.status)}
      ref={markerRef}
      zIndexOffset={500}
    >
      <Popup>
        <div className="text-right min-w-[200px]" dir="rtl">
          <div className="flex items-center gap-1.5 font-bold text-sm text-gray-800">
            <Router size={14} className="text-blue-600 flex-shrink-0" />
            <span>{d.name}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1.5">
            {TYPE_LABELS[d.device_type] || d.device_type}{d.model ? ` · ${d.model}` : ''}
            {' — '}<span style={{ color: st.color }} className="font-bold">{st.label}</span>
          </div>
          {d.ip_address && (
            <div className="text-xs text-gray-500 mt-0.5 font-mono" dir="ltr">{d.ip_address}</div>
          )}
          {d.coordinate_source && (
            <div className="text-[10px] text-gray-400 mt-1">
              موقع: {SOURCE_LABELS[d.coordinate_source]}{d.gps_accuracy != null ? ` ±${Math.round(d.gps_accuracy)}م` : ''}
            </div>
          )}
          <div className="text-[10px] text-gray-400 font-mono" dir="ltr">
            {d.location_lat?.toFixed(5)}, {d.location_lng?.toFixed(5)}
          </div>
          <button
            onClick={() => window.__openDeviceDetails?.(d.id)}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg py-1.5 transition-colors"
          >
            فتح تفاصيل الجهاز في تبويب الأجهزة
          </button>
        </div>
      </Popup>
    </Marker>
  )
}

export default function MapPointsPage() {
  const { user } = useAuthStore()
  const canReview = user?.role === 'admin' || user?.role === 'support'
  const canCreateDevice = user?.role === 'admin' // الأجهزة: الكتابة للمدير (مفروضة في الخلفية)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState('pending')
  const [addMode, setAddMode] = useState(false)
  const [newPoint, setNewPoint] = useState(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [saveKind, setSaveKind] = useState('point')     // نقطة خريطة أو جهاز حقيقي
  const [deviceType, setDeviceType] = useState('router')
  // طبقات الخريطة — مزامنة تبويب الخريطة مع تبويب الأجهزة
  const [showDevices, setShowDevices] = useState(true)
  const [showApproved, setShowApproved] = useState(true)
  const [showPending, setShowPending] = useState(true)
  const [focusedDeviceId, setFocusedDeviceId] = useState(null)

  // القدوم من تفاصيل الجهاز ("عرض على خريطة النظام") → تحليق للجهاز وفتح popup
  useEffect(() => {
    const fid = location.state?.focusDeviceId
    if (fid != null) {
      setFocusedDeviceId(fid)
      setShowDevices(true)
      navigate('/map-points', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  // جسر آمن بين popup الخريطة وتنقل React Router (داخل leaflet popup لا يصل سياق الراوتر بسهولة)
  useEffect(() => {
    window.__openDeviceDetails = (id) => navigate('/devices', { state: { focusDeviceId: id } })
    return () => { delete window.__openDeviceDetails }
  }, [navigate])

  const { data, isLoading } = useQuery({
    queryKey: ['map-points', filter],
    queryFn: () => mapPointsApi.getAll(filter ? { status: filter } : {})
  })

  // مزامنة: الأجهزة ذات الموقع تُرسم على الخريطة (نفس بيانات تبويب الأجهزة)
  const { data: devicesData } = useQuery({
    queryKey: ['devices-map'],
    queryFn: () => devicesApi.list({ has_location: true, limit: 500 }),
  })
  const devices = Array.isArray(devicesData?.data?.items) ? devicesData.data.items : []

  // إبطال موحّد لأي تغيير — كل التبويبات تنعكس فوراً
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['map-points'] })
    queryClient.invalidateQueries({ queryKey: ['devices'] })
    queryClient.invalidateQueries({ queryKey: ['devices-map'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }) => mapPointsApi.review(id, status),
    onSuccess: () => {
      invalidateAll() // الاعتماد يغير عدّادات الداشبورد أيضاً
      toast.success('تمت المراجعة بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const createPointMutation = useMutation({
    mutationFn: (payload) => mapPointsApi.create(payload),
    onSuccess: (resp) => {
      invalidateAll()
      toast.success(resp?.message || 'تمت إضافة النقطة — بانتظار موافقة المدير ثم تظهر على الخريطة')
      resetModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء الإضافة'),
  })

  const createDeviceMutation = useMutation({
    mutationFn: (payload) => devicesApi.create(payload),
    onSuccess: () => {
      invalidateAll()
      toast.success('تمت إضافة الجهاز — يظهر الآن في تبويب الأجهزة وعلى الخريطة والداشبورد', { duration: 5000 })
      resetModal()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء إضافة الجهاز'),
  })

  const resetModal = () => {
    setNewPoint(null)
    setName('')
    setNote('')
    setAddMode(false)
    setSaveKind('point')
    setDeviceType('router')
  }

  const submitNewPoint = () => {
    if (!name.trim()) {
      toast.error(saveKind === 'device' ? 'اسم الجهاز مطلوب' : 'اسم النقطة مطلوب')
      return
    }
    if (saveKind === 'device') {
      // جهاز حقيقي في جدول devices — يظهر فوراً في تبويب الأجهزة + الخريطة + الداشبورد
      createDeviceMutation.mutate({
        name: name.trim(),
        device_type: deviceType,
        notes: note.trim() || null,
        location_lat: newPoint.lat,
        location_lng: newPoint.lng,
        coordinate_source: 'manual',
        status: 'offline',
      })
      return
    }
    // نقطة خريطة — تمر بمراجعة المدير ثم تظهر على الخريطة
    createPointMutation.mutate({
      name: name.trim(),
      note: note.trim() || undefined,
      location_lat: newPoint.lat,
      location_lng: newPoint.lng,
    })
  }

  // GET /map-points يعيد { items, pagination } — وليس مصفوفة مباشرة
  const points = Array.isArray(data?.data?.items) ? data.data.items : []
  const approvedPoints = points.filter(p => p.status === 'approved')
  const pendingPoints = points.filter(p => p.status === 'pending')
  const pendingCount = pendingPoints.length
  const saving = createPointMutation.isPending || createDeviceMutation.isPending

  const statItems = [
    { label: 'بانتظار المراجعة', color: 'text-amber-600 dark:text-amber-400', status: 'pending', gradient: 'gradient-orange' },
    { label: 'معتمدة', color: 'text-emerald-600 dark:text-emerald-400', status: 'approved', gradient: 'gradient-green' },
    { label: 'مرفوضة', color: 'text-red-600 dark:text-red-400', status: 'rejected', gradient: 'gradient-red' },
  ]

  const layerChip = (active, onClick, icon, label) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
        active
          ? 'gradient-primary text-white shadow-md shadow-primary/20 border-transparent'
          : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 line-through'
      }`}
    >
      {icon}{label}
    </button>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">نقاط الخريطة والأجهزة</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            الأجهزة والنقاط على خريطة واحدة — متزامنة مباشرة مع تبويب الأجهزة والداشبورد
          </p>
        </div>
        <button
          onClick={() => { setAddMode((m) => !m); setNewPoint(null) }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
            addMode
              ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/25'
              : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/25'
          }`}
        >
          {addMode ? <X size={15} /> : <Plus size={15} />}
          {addMode ? 'إلغاء وضع الإضافة' : 'إضافة نقطة / جهاز'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 stagger-children">
        {statItems.map(x => (
          <div key={x.status} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`${x.gradient} p-2 rounded-lg text-white shadow-sm`}>
                <MapPin size={16} />
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{x.label}</div>
                <div className={`text-xl font-bold ${x.color}`}>
                  {points.filter(p => p.status === x.status).length}
                </div>
              </div>
            </div>
          </div>
        ))}
        {/* بطاقة الأجهزة ذات الموقع — عدّاد مباشر من جدول devices */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="gradient-primary p-2 rounded-lg text-white shadow-sm">
              <Router size={16} />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">أجهزة على الخريطة</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{devices.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s === 'all' ? '' : s)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              ((s === 'all' && !filter) || filter === s)
                ? 'gradient-primary text-white shadow-md shadow-primary/20'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Map size={14} />
            {s === 'all' ? 'الكل' : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Map Layer Chips — إظهار/إخفاء الأجهزة والنقاط */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">طبقات الخريطة:</span>
        {layerChip(showDevices, () => setShowDevices(v => !v), <Router size={14} />, `الأجهزة (${devices.length})`)}
        {layerChip(showApproved, () => setShowApproved(v => !v), <MapPin size={14} />, `نقاط معتمدة (${approvedPoints.length})`)}
        {layerChip(showPending, () => setShowPending(v => !v), <Clock size={14} />, `بانتظار المراجعة (${pendingCount})`)}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points List */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/20">
            <h2 className="font-bold text-sm text-gray-900 dark:text-white">الطلبات</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/30 max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 size={24} className="animate-spin text-primary" />
                <p className="text-sm text-gray-400 dark:text-gray-500">جاري التحميل...</p>
              </div>
            ) : points.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
                  <Inbox size={24} className="text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد نقاط</p>
              </div>
            ) : (
              points.map((point, idx) => (
                <div key={point.id} className="p-4 hover:bg-gray-50/80 dark:hover:bg-gray-700/20 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{point.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                        <MapPin size={12} />
                        <span>{point.location_lat?.toFixed(5)}, {point.location_lng?.toFixed(5)}</span>
                      </div>
                      {point.note && (
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2">
                          {point.note}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-400 dark:text-gray-500">
                        <span>بواسطة: {point.creator_name || '-'}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {point.created_at ? new Date(point.created_at).toLocaleDateString('ar-SA') : '-'}
                        </span>
                      </div>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${statusColors[point.status] || statusColors.pending}`}>
                      {statusLabels[point.status] || point.status}
                    </span>
                  </div>
                  {point.status === 'pending' && canReview && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => reviewMutation.mutate({ id: point.id, status: 'approved' })}
                        className="flex items-center gap-1.5 bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors shadow-sm"
                      >
                        <Check size={13} />
                        موافقة
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate({ id: point.id, status: 'rejected' })}
                        className="flex items-center gap-1.5 bg-red-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors shadow-sm"
                      >
                        <X size={13} />
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="card overflow-hidden h-[500px] relative">
          {addMode && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              {newPoint ? 'أكمل البيانات في النموذج' : 'انقر على الخريطة في موضع النقطة أو الجهاز الجديد'}
            </div>
          )}
          <MapContainer center={[24.7136, 46.6753]} zoom={13} style={{ height: '100%', width: '100%' }} className="z-10">
            <MapClickCatcher active={addMode && !newPoint} onSelect={setNewPoint} />
            <LocateControl />
            <LayerToggle />
            {newPoint && <Marker position={[newPoint.lat, newPoint.lng]} icon={newPointIcon} />}
            {/* الأجهزة — مزامنة حية مع تبويب الأجهزة */}
            {showDevices && devices.map(d => (
              <DeviceMarker key={`dev-${d.id}`} device={d} focused={focusedDeviceId != null && String(d.id) === String(focusedDeviceId)} />
            ))}
            {/* النقاط المعتمدة */}
            {showApproved && approvedPoints.filter(p => p.location_lat && p.location_lng).map(p => (
              <Marker key={p.id} position={[p.location_lat, p.location_lng]} icon={approvedPointIcon}>
                <Popup>
                  <div className="text-right min-w-[150px]" dir="rtl">
                    <div className="font-bold text-sm">{p.name}</div>
                    {p.note && <div className="text-xs text-gray-500 mt-1">{p.note}</div>}
                    <div className="text-[10px] text-emerald-600 mt-1">نقطة معتمدة ✓</div>
                  </div>
                </Popup>
              </Marker>
            ))}
            {/* النقاط بانتظار المراجعة */}
            {showPending && pendingPoints.filter(p => p.location_lat && p.location_lng).map(p => (
              <Marker key={`pend-${p.id}`} position={[p.location_lat, p.location_lng]} icon={pendingPointIcon}>
                <Popup>
                  <div className="text-right min-w-[150px]" dir="rtl">
                    <div className="font-bold text-sm">{p.name}</div>
                    {p.note && <div className="text-xs text-gray-500 mt-1">{p.note}</div>}
                    <div className="text-[10px] text-amber-600 mt-1">بانتظار موافقة المدير</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          {/* دليل العلامات */}
          <div className="absolute bottom-3 right-3 z-[500] bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1.5 pointer-events-none">
            <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <span className="w-3 h-3 rounded" style={{ background: DEVICE_STATUS.online.color }} /> جهاز متصل
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <span className="w-3 h-3 rounded" style={{ background: DEVICE_STATUS.offline.color }} /> جهاز غير متصل
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <span className="w-3 h-3 rounded" style={{ background: DEVICE_STATUS.maintenance.color }} /> جهاز بصيانة / نقطة بانتظار
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <span className="w-3 h-3 rounded-full" style={{ background: '#10B981' }} /> نقطة معتمدة
            </div>
          </div>
        </div>
      </div>

      {/* Add Point / Device Modal */}
      {newPoint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNewPoint(null)}>
          <div className="card p-6 w-full max-w-md bg-white dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">إضافة نقطة / جهاز جديد</h3>
              <button onClick={() => setNewPoint(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2">
              <MapPin size={12} className="text-red-500" />
              <span>الإحداثيات: {newPoint.lat.toFixed(5)}, {newPoint.lng.toFixed(5)}</span>
            </div>

            {/* نوع الحفظ — جهاز حقيقي أو نقطة تمر بمراجعة */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نوع الحفظ</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSaveKind('point')}
                aria-pressed={saveKind === 'point'}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  saveKind === 'point'
                    ? 'gradient-primary text-white border-transparent shadow-md shadow-primary/20'
                    : 'bg-white dark:bg-gray-900/60 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <MapPin size={14} className="inline ml-1" /> نقطة خريطة
              </button>
              <button
                type="button"
                onClick={() => canCreateDevice && setSaveKind('device')}
                disabled={!canCreateDevice}
                aria-pressed={saveKind === 'device'}
                title={canCreateDevice ? 'حفظ مباشر في تبويب الأجهزة' : 'الأجهزة تُضاف بواسطة المدير فقط'}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  saveKind === 'device'
                    ? 'bg-emerald-500 text-white border-transparent shadow-md shadow-emerald-500/20'
                    : canCreateDevice
                      ? 'bg-white dark:bg-gray-900/60 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      : 'bg-gray-100 dark:bg-gray-900/40 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-gray-700 cursor-not-allowed'
                }`}
              >
                <Router size={14} className="inline ml-1" /> جهاز {canCreateDevice ? '' : '(مدير فقط)'}
              </button>
            </div>

            <label htmlFor="map-item-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {saveKind === 'device' ? 'اسم الجهاز *' : 'اسم النقطة / الجهاز *'}
            </label>
            <input
              id="map-item-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNewPoint()}
              placeholder={saveKind === 'device' ? 'مثال: راوتر حي النزهة' : 'مثال: موقع اشتراك جديد'}
              className="input-field w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 mb-4"
            />

            {saveKind === 'device' && (
              <>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">نوع الجهاز</label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  className="input-field w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </>
            )}

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ملاحظات (اختياري)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={saveKind === 'device' ? 'الموديل، رقم التسلسل، حالة التركيب...' : 'وصف الموقع، حالة التغطية...'}
              className="input-field w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 mb-3 resize-none"
            />

            {/* تنبيه سلوك الحفظ */}
            <div className={`text-xs rounded-lg px-3 py-2 mb-4 leading-relaxed ${
              saveKind === 'device'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
            }`}>
              {saveKind === 'device'
                ? 'سيُحفظ كجهاز فعلي: يظهر فوراً في تبويب الأجهزة وعلى هذه الخريطة وفي عدادات الداشبورد — ويمكنك إكمال بقية البيانات (الرقم التسلسلي، MAC، MikroTik) من تبويب الأجهزة.'
                : 'ستُحفظ كنقطة بانتظار موافقة المدير، وبعد الاعتماد تظهر على الخريطة وتُحسب في الداشبورد.'}
            </div>

            <div className="flex gap-2">
              <button
                onClick={submitNewPoint}
                disabled={saving || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {saveKind === 'device' ? 'حفظ الجهاز' : 'حفظ النقطة'}
              </button>
              <button
                onClick={() => setNewPoint(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
