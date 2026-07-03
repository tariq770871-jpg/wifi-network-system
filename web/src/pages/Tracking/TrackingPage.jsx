import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { trackingApi } from '../../services/tracking.service'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Battery, Navigation, AlertTriangle, RefreshCw, Loader2, MapPin, WifiOff } from 'lucide-react'
import L from '../../lib/leaflet-setup'

export default function TrackingPage() {
  const [selectedTech, setSelectedTech] = useState(null)
  const [refreshInterval, setRefreshInterval] = useState(10)

  const { data: liveDataRaw, isLoading, isError } = useQuery({
    queryKey: ['live-tracking'],
    queryFn: trackingApi.getLive,
    refetchInterval: refreshInterval * 1000,
  })

  const technicians = Array.isArray(liveDataRaw?.data) ? liveDataRaw.data : []

  const getStatusColor = (tech) => {
    if (tech.tracking_veto) return 'bg-amber-500'
    if (!tech.tracking_enabled) return 'bg-gray-400'
    return 'bg-emerald-500'
  }

  const getStatusBg = (tech) => {
    if (tech.tracking_veto) return 'bg-amber-50 dark:bg-amber-500/10'
    if (!tech.tracking_enabled) return 'bg-gray-50 dark:bg-gray-700/30'
    return 'bg-emerald-50 dark:bg-emerald-500/10'
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

  if (isError) {
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">التتبع الحي</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">متابعة مواقع الفنيين في الوقت الحقيقي</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{technicians.length} فني متصل</span>
          </div>
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
        {/* Technicians List */}
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

        {/* Map */}
        <div className="flex-1 card overflow-hidden min-h-[300px]">
          <MapContainer center={[24.7136, 46.6753]} zoom={13} style={{ height: '100%', width: '100%' }} className="z-10">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            {technicians.map((tech) => (
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