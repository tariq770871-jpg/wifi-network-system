import { useState, useRef, useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Crosshair, Loader2 } from 'lucide-react'
import L from '../../lib/leaflet-setup'
import toast from 'react-hot-toast'

const GEO_ERROR_MESSAGES = {
  1: 'إذن الموقع مرفوض — اسمح بالموقع من إعدادات المتصفح ثم أعد المحاولة',
  2: 'الموقع غير متوفر — تأكد من تشغيل GPS وأنك في مكان مكشوف',
  3: 'انتهت مهلة تحديد الموقع — أعد المحاولة',
}

const pinIcon = L.divIcon({
  html: `<div style="width:20px;height:20px;background:#1976D2;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(25,118,210,0.5);"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  className: '',
})

function ClickCatcher({ onSelect }) {
  useMapEvents({
    click: (e) => onSelect({ lat: e.latlng.lat, lng: e.latlng.lng, source: 'manual', accuracy: null }),
  })
  return null
}

function Flyer({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target?.lat) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.8 })
  }, [target, map])
  return null
}

/**
 * منتقي موقع الجهاز: زر GPS (يلتقط الموقع والدقة تلقائياً) أو النقر على الخريطة (يدوي)
 * onPick({ lat, lng, source: 'gps'|'manual', accuracy })
 */
export default function LocationPicker({ value, onPick }) {
  const [locating, setLocating] = useState(false)
  const watchRef = useRef(null)
  const bestRef = useRef(null)

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
  }, [])

  const handleGps = () => {
    if (!navigator.geolocation) {
      toast.error('متصفحك لا يدعم تحديد الموقع الجغرافي')
      return
    }
    setLocating(true)
    bestRef.current = null
    // أول إصلاح سريع ثم تنقية عبر watch حتى أفضل دقة أو مهلة — الدقة تُحفظ مع الإحداثية
    const finish = (pos) => {
      bestRef.current = pos
      onPick({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        source: 'gps',
        accuracy: Math.round(pos.coords.accuracy),
      })
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish(pos)
        if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = navigator.geolocation.watchPosition(
          (p) => {
            if (!bestRef.current || p.coords.accuracy < bestRef.current.coords.accuracy) finish(p)
            if (p.coords.accuracy <= 20 && watchRef.current !== null) {
              navigator.geolocation.clearWatch(watchRef.current)
              watchRef.current = null
              setLocating(false)
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        )
        setTimeout(() => {
          if (watchRef.current !== null) {
            navigator.geolocation.clearWatch(watchRef.current)
            watchRef.current = null
            setLocating(false)
          }
        }, 15000)
      },
      (err) => {
        setLocating(false)
        toast.error(GEO_ERROR_MESSAGES[err?.code] || err?.message || 'تعذر تحديد الموقع', { duration: 6000 })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div className="relative">
      <MapContainer
        center={value?.lat ? [value.lat, value.lng] : [24.7136, 46.6753]}
        zoom={value?.lat ? 16 : 6}
        style={{ height: 260, width: '100%', borderRadius: 12 }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
          maxZoom={19}
        />
        <ClickCatcher onSelect={onPick} />
        <Flyer target={locating ? null : value} />
        {value?.lat && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
      </MapContainer>

      {/* شريط الأدوات العائم — z فوق طبقات leaflet */}
      <div className="absolute top-2 right-2 z-[500] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleGps}
          disabled={locating}
          title="استخدام موقعي الحالي عبر GPS (للهاتف)"
          aria-label="استخدام موقعي الحالي عبر GPS"
          className="flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-60"
        >
          {locating ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
        </button>
      </div>

      {/* تلميح الاستخدام + شارة المصدر */}
      <div className="absolute bottom-2 left-2 right-2 z-[500] flex items-center justify-between gap-2 pointer-events-none">
        <span className="text-[11px] px-2 py-1 rounded-lg bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
          انقر على الخريطة للتحديد اليدوي، أو استخدم زر GPS
        </span>
        {value?.source && (
          <span className={`text-[11px] px-2 py-1 rounded-lg shadow font-medium ${
            value.source === 'gps' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            {value.source === 'gps' ? `GPS ±${value.accuracy ?? '?'}م` : 'تحديد يدوي'}
          </span>
        )}
      </div>
    </div>
  )
}
