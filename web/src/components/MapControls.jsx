import { useState, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { Crosshair, Layers, Satellite, Map as MapIcon, Loader2, MapPin } from 'lucide-react'
import L from '../lib/leaflet-setup'

// Custom icon for user location marker
const userLocationIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#1976D2;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(25,118,210,0.5);"></div>
         <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;background:rgba(25,118,210,0.15);border-radius:50%;"></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: '',
})

const ACCURACY_MESSAGES = {
  1: 'إذن الموقع مرفوض — اسمح بالموقع لهذا الموقع من إعدادات المتصفح (وأختر "الموقع الدقيق") ثم أعد المحاولة',
  2: 'الموقع غير متوفر — تأكد من تشغيل GPS / خدمات الموقع في جهازك وأنك في مكان مكشوف',
  3: 'انتهت مهلة تحديد الموقع — أعد المحاولة، وأفضل دقة تكون في الهواء الطلق',
}

const MANUAL_POS_KEY = 'wifi_manual_position'

/** Locate Me button - GPS locate with accuracy refinement, plus manual mode:
 *  desktops have no GPS receiver, so browsers fall back to WiFi/IP estimates
 *  that can point to a faraway country. Manual mode lets the user click the
 *  map to pin their true position exactly. */
export function LocateControl() {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const [located, setLocated] = useState(false)
  const [error, setError] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [manualMode, setManualMode] = useState(false)
  const [isManual, setIsManual] = useState(false)
  const [lowAccuracy, setLowAccuracy] = useState(false)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const watchIdRef = useRef(null)
  const stopTimerRef = useRef(null)
  const bestRef = useRef(null)

  const stopWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
  }

  const placeMarker = (latlng, tooltip) => {
    if (markerRef.current) {
      markerRef.current.setLatLng(latlng)
    } else {
      markerRef.current = L.marker(latlng, { icon: userLocationIcon }).addTo(map)
    }
    markerRef.current.bindTooltip(tooltip, { permanent: false, direction: 'top' })
  }

  const applyFix = (pos) => {
    const { latitude, longitude, accuracy: acc } = pos.coords
    const latlng = [latitude, longitude]
    setIsManual(false)
    setLowAccuracy(acc > 1000)
    // تكبير مناسب لمستوى الدقة: دقيق → أقرب، تقريبي → أوسع
    const zoom = acc < 30 ? 18 : acc < 100 ? 16 : acc < 500 ? 14 : 12
    map.flyTo(latlng, zoom, { duration: 1.2 })
    placeMarker(
      latlng,
      acc <= 20 ? 'موقعك الحالي (دقة عالية)' : `دقة التحديد: ±${Math.round(acc)} متر`
    )
    if (circleRef.current) {
      circleRef.current.setLatLng(latlng).setRadius(acc)
    } else {
      circleRef.current = L.circle(latlng, {
        radius: acc,
        color: '#1976D2',
        weight: 1,
        fillColor: '#1976D2',
        fillOpacity: 0.08,
      }).addTo(map)
    }
    setAccuracy(Math.round(acc))
  }

  /** تحديد موقع يدوي: النقر على الخريطة يضع الموقع الحقيقي ويحفظه */
  const setManualPosition = (lat, lng, { fly = true } = {}) => {
    stopWatch()
    setLocating(false)
    setLocated(true)
    setIsManual(true)
    setLowAccuracy(false)
    setAccuracy(null)
    setManualMode(false)
    setError(null)
    const latlng = [lat, lng]
    if (fly) {
      map.flyTo(latlng, Math.max(map.getZoom(), 16), { duration: 1 })
    } else {
      map.setView(latlng, Math.max(map.getZoom(), 14))
    }
    placeMarker(latlng, 'موقعي (محدد يدوياً)')
    if (circleRef.current) {
      circleRef.current.remove()
      circleRef.current = null
    }
    try {
      localStorage.setItem(MANUAL_POS_KEY, JSON.stringify({ lat, lng }))
    } catch { /* التخزين غير متاح */ }
  }

  // استعادة الموقع اليدوي المحفوظ عند فتح الخريطة
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(MANUAL_POS_KEY) || 'null')
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)
        && Math.abs(saved.lat) <= 90 && Math.abs(saved.lng) <= 180) {
        setManualPosition(saved.lat, saved.lng, { fly: false })
      }
    } catch { /* لا يوجد موقع محفوظ */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // وضع التحديد اليدوي: مؤشر تصويب + النقر على الخريطة يضع الموقع
  useEffect(() => {
    if (!manualMode) return
    const container = map.getContainer()
    container.style.cursor = 'crosshair'
    const onClick = (e) => setManualPosition(e.latlng.lat, e.latlng.lng)
    map.on('click', onClick)
    return () => {
      container.style.cursor = ''
      map.off('click', onClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode, map])

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setError('متصفحك لا يدعم تحديد الموقع الجغرافي')
      return
    }
    setLocating(true)
    setError(null)
    setManualMode(false)
    bestRef.current = null

    // المرحلة 1: إصلاح أولي سريع للانتقال للموقع
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bestRef.current = pos
        applyFix(pos)
        setLocated(true)
        setLocating(false)

        // المرحلة 2: تنقية تدريجية عبر GPS حتى نصل لدقة جيدة أو تنتهي المهلة
        stopWatch()
        watchIdRef.current = navigator.geolocation.watchPosition(
          (p) => {
            if (!bestRef.current || p.coords.accuracy < bestRef.current.coords.accuracy) {
              bestRef.current = p
              applyFix(p)
            }
            if (p.coords.accuracy <= 20) stopWatch()
          },
          () => {},
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        )
        stopTimerRef.current = setTimeout(stopWatch, 15000)
      },
      (err) => {
        setLocating(false)
        setError(ACCURACY_MESSAGES[err.code] || err.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // تنظيف عند إلغاء التركيب
  useEffect(() => () => stopWatch(), [])

  return (
    <>
      <div className="leaflet-top leaflet-right" style={{ top: 10, right: 10 }}>
        <div className="leaflet-control bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={handleLocate}
            disabled={locating}
            className={`flex items-center justify-center w-10 h-10 transition-colors ${
              locating ? 'text-gray-400 cursor-wait' :
              located && !isManual ? 'text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10' :
              'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="تحديد موقعي عبر GPS (للهاتف) أو تقدير الشبكة"
            aria-label="تحديد موقعي الحالي"
          >
            {locating ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
          </button>
          <div className="h-px bg-gray-200 dark:bg-gray-700" />
          <button
            onClick={() => setManualMode((m) => !m)}
            className={`flex items-center justify-center w-10 h-10 transition-colors ${
              manualMode ? 'bg-primary text-white' :
              'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="تحديد يدوي: انقر على الخريطة لوضع موقعك الحقيقي بدقة (الأنسب للكمبيوتر)"
            aria-label="تحديد موقعي يدوياً بالنقر على الخريطة"
          >
            <MapPin size={18} />
          </button>
        </div>
        {/* شارة الحالة */}
        {located && !locating && isManual && (
          <div
            className="leaflet-control mt-2 bg-emerald-50/95 dark:bg-emerald-900/80 backdrop-blur rounded-lg shadow border border-emerald-200 dark:border-emerald-700 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
            style={{ maxWidth: 200 }}
          >
            ✓ موقع يدوي — حسب تحديدك على الخريطة
          </div>
        )}
        {located && !locating && !isManual && accuracy !== null && (
          <div
            className="leaflet-control mt-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-lg shadow border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap"
            style={{ maxWidth: 160 }}
          >
            {accuracy <= 20 ? '✓ موقع دقيق' : accuracy <= 100 ? 'دقة جيدة' : 'دقة تقريبية'}: ±{accuracy}م
          </div>
        )}
        {/* تحذير الدقة المتدنية: تقدير شبكة/IP وليس GPS */}
        {lowAccuracy && !isManual && !locating && (
          <div
            className="leaflet-control mt-2 bg-amber-50/95 dark:bg-amber-900/80 backdrop-blur rounded-lg shadow border border-amber-200 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
            style={{ maxWidth: 240 }}
          >
            <b>الموقع الظاهر بعيد عنك؟</b> الكمبيوتر لا يحتوي GPS والمتصفح يقدّر الموقع عبر WiFi/IP وقد يضعه في دولة أخرى.
            اضغط أيقونة الدبوس ثم انقر على موقعك الحقيقي على الخريطة، أو استخدم هاتفاً لدقة أفضل.
            <button
              onClick={() => setLowAccuracy(false)}
              className="mr-2 underline font-semibold"
              aria-label="إغلاق التحذير"
            >
              إغلاق
            </button>
          </div>
        )}
        {/* تعليمات وضع التحديد اليدوي */}
        {manualMode && (
          <div
            className="leaflet-control mt-2 bg-blue-50/95 dark:bg-blue-900/80 backdrop-blur rounded-lg shadow border border-blue-200 dark:border-blue-700 px-3 py-2 text-xs text-blue-700 dark:text-blue-200 leading-relaxed"
            style={{ maxWidth: 240 }}
          >
            انقر على الخريطة في موقعك الحقيقي لتحديده كموقعك بدقة
            <button
              onClick={() => setManualMode(false)}
              className="mr-2 underline font-semibold"
              aria-label="إلغاء التحديد اليدوي"
            >
              إلغاء
            </button>
          </div>
        )}
        {/* رسالة الخطأ */}
        {error && (
          <div
            className="leaflet-control mt-2 bg-red-50/95 dark:bg-red-900/80 backdrop-blur rounded-lg shadow border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300"
            style={{ maxWidth: 220 }}
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="mr-2 underline font-semibold"
              aria-label="إغلاق التنبيه"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/** Layer toggle button - switches between street and satellite */
export function LayerToggle() {
  const map = useMap()
  const [satellite, setSatellite] = useState(false)
  const streetRef = useRef(null)
  const satRef = useRef(null)

  useEffect(() => {
    // Street layer (OpenStreetMap)
    streetRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    // Satellite layer (ESRI World Imagery)
    satRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
    })

    return () => {
      streetRef.current?.remove()
      satRef.current?.remove()
    }
  }, [map])

  const toggle = () => {
    if (satellite) {
      map.removeLayer(satRef.current)
      streetRef.current.addTo(map)
    } else {
      map.removeLayer(streetRef.current)
      satRef.current.addTo(map)
    }
    setSatellite(prev => !prev)
  }

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 56, right: 10 }}>
      <div className="leaflet-control bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={toggle}
          className={`flex items-center gap-2 px-3 h-10 text-sm font-medium transition-colors ${
            satellite
              ? 'text-primary bg-blue-50 dark:bg-blue-500/10'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={satellite ? 'خريطة شوارع' : 'أقمار صناعية'}
        >
          {satellite ? <MapIcon size={16} /> : <Satellite size={16} />}
          <span className="hidden sm:inline">{satellite ? 'شوارع' : 'فضائي'}</span>
        </button>
      </div>
    </div>
  )
}
