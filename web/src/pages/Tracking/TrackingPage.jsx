import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { trackingApi } from '../../services/tracking.service'
import { useAuthStore } from '../../hooks/useAuth'
import { MapContainer, Marker, Popup } from 'react-leaflet'
import { Battery, Navigation, AlertTriangle, RefreshCw, Loader2, MapPin, WifiOff, Play, Square, ShieldOff, Clock } from 'lucide-react'
import L from '../../lib/leaflet-setup'
import toast from 'react-hot-toast'
import { LocateControl, LayerToggle } from '../../components/MapControls'

// رسائل أخطاء الموقع الجغرافي من المتصفح (codes من GeolocationPositionError)
const GEO_ERROR_MESSAGES = {
  1: 'إذن الموقع مرفوض — اسمح بالموقع لهذا الموقع من إعدادات المتصفح (اختر "الموقع الدقيق") ثم أعد المحاولة',
  2: 'الموقع غير متوفر — تأكد من تشغيل GPS / خدمات الموقع في جهازك وأنك في مكان مكشوف',
  3: 'انتهت مهلة تحديد الموقع — جارٍ إعادة المحاولة تلقائياً، وأفضل دقة تكون في الهواء الطلق',
}

/** استخراج رسالة خطأ API مفهومة من كائن axios (الخادم يرسل error أو message) */
function extractApiError(err) {
  const status = err?.response?.status
  const msg = err?.response?.data?.error || err?.response?.data?.message
  if (status === 403) return { fatal: true, message: msg || 'التتبع غير مفعّل لحسابك — تواصل مع المدير' }
  if (status === 401) return { fatal: true, message: 'انتهت الجلسة — أعد تسجيل الدخول' }
  if (status) return { fatal: false, message: msg || `خطأ من الخادم (${status})` }
  return { fatal: false, message: 'تعذر الاتصال بالخادم — تحقق من اتصالك بالإنترنت' }
}

export default function TrackingPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [selectedTech, setSelectedTech] = useState(null)
  const [refreshInterval, setRefreshInterval] = useState(10)
  // آلة حالة البث: watchRunning = المراقبة تعمل | savedOnce = نجح أول حفظ على الخادم
  // "GPS نشط" لا تظهر إلا عند (watchRunning && savedOnce) — وليس مجرد فتح المراقبة
  const [watchRunning, setWatchRunning] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)
  const [gpsError, setGpsError] = useState(null)      // { kind: 'geo'|'api'|'network', message }
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [sendFailures, setSendFailures] = useState(0)
  const watchIdRef = useRef(null)

  const isTechnician = user?.role === 'technician'

  // حالة التتبع من الخادم (مفعّل/موقوف + السبب) — تحذير مبكر قبل بدء البث
  const { data: statusData } = useQuery({
    queryKey: ['tracking-status'],
    queryFn: trackingApi.getStatus,
    enabled: isTechnician,
    staleTime: 30000,
  })
  const trackStatus = statusData?.data || null

  const { data: liveDataRaw, isLoading, isError } = useQuery({
    queryKey: ['live-tracking'],
    queryFn: trackingApi.getLive,
    refetchInterval: refreshInterval * 1000,
    enabled: !isTechnician,
  })

  const technicians = Array.isArray(liveDataRaw?.data) ? liveDataRaw.data : []

  // GPS tracking for technicians — كل فشل يُعرض للمستخدم ولا يُخفى
  // إيقاف داخلي (يُستخدم داخل معالجات بدون إعادة تعريف callback)
  const stopTrackingInternal = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatchRunning(false)
  }, [])
  const gpsErrorRef = useRef(null)
  useEffect(() => { gpsErrorRef.current = gpsError }, [gpsError])

  const sendLocation = useCallback(async (pos) => {
    try {
      await trackingApi.logLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : 0,
        battery: null,
        signal_dbm: null,
      })
      // أول حفظ ناجح هو ما يفعّل شارة "GPS نشط"
      setSavedOnce(true)
      setLastSavedAt(new Date())
      setSendFailures(0)
      if (gpsErrorRef.current) {
        setGpsError(null)
        toast.success('تم استئناف إرسال الموقع بنجاح')
      }
    } catch (err) {
      const info = extractApiError(err)
      setSendFailures((n) => n + 1)
      setGpsError({ kind: info.fatal ? 'api' : 'network', message: info.message })
      toast.error(info.message, { duration: 6000 })
      if (info.fatal) {
        // رفض 403 يعني أن الاستمرار بلا فائدة — أوقف المراقبة وأعرض السبب
        stopTrackingInternal()
      }
    }
  }, [stopTrackingInternal])

  // أخطاء المتصفح الجغرافية (إذن/توفر/مهلة) — كانت مُلقاة سابقاً في callback فارغ
  const handleGeoError = useCallback((err) => {
    const message = GEO_ERROR_MESSAGES[err?.code] || err?.message || 'تعذر تحديد الموقع'
    setGpsError({ kind: 'geo', message })
    if (err?.code === 1) {
      // إذن مرفوض: إعادة المحاولة بلا فائدة حتى يسمح المستخدم
      stopTrackingInternal()
      toast.error(message, { duration: 7000 })
    }
  }, [stopTrackingInternal])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError({ kind: 'geo', message: 'متصفحك لا يدعم تحديد الموقع الجغرافي' })
      return
    }
    setGpsError(null)
    setSavedOnce(false)
    setSendFailures(0)
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      handleGeoError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
    setWatchRunning(true)
  }, [sendLocation, handleGeoError])

  const stopTracking = useCallback(() => {
    stopTrackingInternal()
  }, [stopTrackingInternal])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  const getStatusColor = (tech) => {
    if (tech.tracking_veto) return 'bg-amber-500'
    if (!tech.tracking_enabled) return 'bg-gray-400'
    return 'bg-emerald-500'
  }
  const getStatusText = (tech) => {
    if (tech.tracking_veto) return 'موقوف يدوياً'
    if (!tech.tracking_enabled) return 'متوقف'
    return 'نشط'
  }
  const getStatusTextColor = (tech) => {
    if (tech.tracking_veto) return 'text-amber-600 dark:text-amber-400'
    if (!tech.tracking_enabled) return 'text-gray-500 dark:text-gray-400'
    return 'text-emerald-600 dark:text-emerald-400'
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center animate-fade-in">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">جاري تحميل مواقع الفنيين...</p>
        </div>
      </div>
    )
  }

  if (isError && !isTechnician) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center animate-fade-in">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">فشل في تحميل بيانات التتبع</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">تأكد من اتصالك بالإنترنت وحاول مرة أخرى</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التتبع الحي</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isTechnician ? 'شارك موقعك مع الإدارة في الوقت الحقيقي' : 'متابعة مواقع الفنيين في الوقت الحقيقي'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Technician: GPS tracking toggle */}
          {isTechnician && (
            <button
              onClick={watchRunning ? stopTracking : startTracking}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-sm ${
                watchRunning
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/25'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/25'
              }`}
            >
              {watchRunning ? <><Square size={15} /> إيقاف البث</> : <><Play size={15} /> بدء البث</>}
              {watchRunning && (
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              )}
            </button>
          )}

          {/* Admin/Support: live count */}
          {!isTechnician && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{technicians.length} فني متصل</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
            <RefreshCw size={12} className="text-blue-500" />
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-xs font-medium text-blue-600 dark:text-blue-400 border-0 focus:ring-0 cursor-pointer pr-1"
            >
              <option value={5}>كل 5 ثواني</option>
              <option value={10}>كل 10 ثواني</option>
              <option value={30}>كل 30 ثانية</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4" style={{ height: 'calc(100vh - 10rem)' }}>
        {/* Technicians List (admin/support only) */}
        {!isTechnician && (
          <div className="w-full lg:w-80 card overflow-hidden flex-shrink-0 lg:max-h-full max-h-52">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
              <h2 className="font-bold text-sm text-gray-900 dark:text-white">الفنيين</h2>
            </div>
            <div className="overflow-y-auto max-h-[calc(100%-56px)]">
              {technicians.length === 0 ? (
                <div className="p-8 text-center">
                  <WifiOff size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">لا يوجد فنين متصلين</p>
                </div>
              ) : (
                technicians.map((tech, idx) => (
                  <div
                    key={tech.user_id || tech.id}
                    onClick={() => setSelectedTech(tech)}
                    className={`px-4 py-3.5 border-b border-gray-50 dark:border-gray-700/30 cursor-pointer transition-all duration-200 animate-fade-in ${
                      selectedTech?.user_id === tech.user_id
                        ? 'bg-blue-50 dark:bg-blue-500/10 border-l-2 border-l-primary'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/20'
                    }`}
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(tech)}`} />
                        {tech.tracking_enabled && !tech.tracking_veto && (
                          <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${getStatusColor(tech)} opacity-40 animate-ping`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{tech.full_name}</div>
                        <div className={`text-xs mt-0.5 ${getStatusTextColor(tech)}`}>{getStatusText(tech)}</div>
                      </div>
                    </div>
                    {tech.speed > 0 && (
                      <div className="mt-2.5 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 mr-5.5">
                        <span className="flex items-center gap-1"><Navigation size={11} />{tech.speed?.toFixed(1)} km/h</span>
                        <span className="flex items-center gap-1">
                          <Battery size={11} />
                          <span className={tech.battery < 20 ? 'text-red-500 font-medium' : ''}>{tech.battery}%</span>
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Technician: tracking status card */}
        {isTechnician && (
          <div className="w-full lg:w-80 card overflow-hidden flex-shrink-0 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${
                watchRunning && savedOnce ? 'bg-emerald-500 animate-pulse' :
                watchRunning ? 'bg-amber-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <h2 className="font-bold text-sm text-gray-900 dark:text-white">
                {watchRunning && savedOnce ? 'جاري البث المباشر' : watchRunning ? 'بانتظار أول حفظ ناجح' : 'البث متوقف'}
              </h2>
            </div>
            {/* تحذير مبكر: التتبع غير مفعّل/موقوف — قبل إضاعة وقت المستخدم */}
            {trackStatus && !trackStatus.can_track && (
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 text-xs font-medium leading-relaxed">
                  <ShieldOff size={15} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <b>لا يمكنك البث حالياً:</b> {trackStatus.reason}
                  </div>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {watchRunning && savedOnce
                ? 'يتم مشاركة موقعك مع الإدارة الآن — تم تأكيد الحفظ على الخادم. سيتم تحديث موقعك تلقائياً كل بضع ثوانٍ.'
                : watchRunning
                  ? 'تم فتح مراقبة GPS، لكن لا يعتبر البث نشطاً إلا بعد نجاح أول عملية حفظ على الخادم.'
                  : 'اضغط على زر "بدء البث" لمشاركة موقعك مع الإدارة في الوقت الحقيقي.'}
            </p>
            {watchRunning && savedOnce && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Navigation size={14} />
                  GPS نشط — يتم حفظ موقعك على الخادم
                </div>
                {lastSavedAt && (
                  <div className="flex items-center gap-2 text-emerald-600/80 dark:text-emerald-400/80 text-[11px] mt-1.5">
                    <Clock size={11} />
                    آخر حفظ ناجح: {lastSavedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>
            )}
            {/* بانتظار أول حفظ — حالة وسطى صريحة */}
            {watchRunning && !savedOnce && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <Loader2 size={14} className="animate-spin" />
                  جارٍ تحديد الموقع وإرساله…
                </div>
              </div>
            )}
            {/* عرض الأخطاء: رفض API / إذن المتصفح / مهلة / شبكة — لا شيء يُخفى */}
            {gpsError && (
              <div className={`mt-3 p-3 rounded-xl border ${
                gpsError.kind === 'api'
                  ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'}`}>
                <div className="flex items-start gap-2 text-xs leading-relaxed">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <b>{gpsError.kind === 'api' ? 'رفض الخادم حفظ الموقع' : 'مشكلة في تحديد الموقع'}:</b>{' '}
                    {gpsError.message}
                    {sendFailures > 0 && <div className="mt-1 opacity-70">عدد الإرسالات الفاشلة: {sendFailures}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map */}
        <div className="flex-1 card overflow-hidden min-h-[300px]">
          <MapContainer center={[24.7136, 46.6753]} zoom={13} style={{ height: '100%', width: '100%' }} className="z-10">
            {/* Default street layer - will be managed by LayerToggle */}
            <LocateControl />
            <LayerToggle />
            {!isTechnician && technicians.map((tech) => (
              tech.lat && tech.lng && (
                <Marker key={tech.user_id || tech.id} position={[tech.lat, tech.lng]}>
                  <Popup>
                    <div className="text-right min-w-[180px]">
                      <div className="font-bold text-sm">{tech.full_name}</div>
                      <div className={`text-xs mt-0.5 ${getStatusTextColor(tech)}`}>{getStatusText(tech)}</div>
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-1.5"><Battery size={11} /> البطارية: {tech.battery}%</div>
                        <div className="flex items-center gap-1.5"><Navigation size={11} /> الإشارة: {tech.signal_dbm} dBm</div>
                        <div className="flex items-center gap-1.5"><MapPin size={11} /> آخر تحديث: {tech.last_update ? new Date(tech.last_update).toLocaleTimeString('ar-SA') : '-'}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}