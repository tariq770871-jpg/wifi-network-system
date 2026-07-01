import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { trackingApi } from '../../services/tracking.service'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Wifi, Battery, Navigation, Clock } from 'lucide-react'

import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = defaultIcon

export default function TrackingPage() {
  const [selectedTech, setSelectedTech] = useState(null)
  const [refreshInterval, setRefreshInterval] = useState(10)

  const { data: liveData, isLoading } = useQuery({
    queryKey: ['live-tracking'],
    queryFn: trackingApi.getLive,
    refetchInterval: refreshInterval * 1000,
  })

  const technicians = liveData || []

  const getStatusColor = (tech) => {
    if (tech.tracking_veto) return 'text-yellow-500'
    if (!tech.tracking_enabled) return 'text-gray-400'
    return 'text-green-500'
  }

  const getStatusText = (tech) => {
    if (tech.tracking_veto) return 'موقوف يدوياً'
    if (!tech.tracking_enabled) return 'متوقف'
    return 'نشط'
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">جاري تحميل مواقع الفنيين...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">التتبع الحي</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{technicians.length} فني متصل</span>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="border rounded-lg px-3 py-1 text-sm"
          >
            <option value={5}>تحديث كل 5 ثواني</option>
            <option value={10}>تحديث كل 10 ثواني</option>
            <option value={30}>تحديث كل 30 ثانية</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4 h-full">
        <div className="w-80 bg-white rounded-xl shadow-sm border overflow-auto">
          <div className="p-4 border-b"><h2 className="font-bold">الفنيين</h2></div>
          {technicians.length === 0 ? (
            <div className="p-4 text-center text-gray-500">لا يوجد فنين متصلين</div>
          ) : (
            technicians.map((tech) => (
              <div
                key={tech.user_id}
                onClick={() => setSelectedTech(tech)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedTech?.user_id === tech.user_id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(tech).replace('text-', 'bg-')}`} />
                  <div className="flex-1">
                    <div className="font-medium">{tech.full_name}</div>
                    <div className="text-xs text-gray-500">{getStatusText(tech)}</div>
                  </div>
                </div>
                {tech.speed > 0 && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Navigation size={12} />{tech.speed?.toFixed(1)} km/h</span>
                    <span className="flex items-center gap-1"><Battery size={12} />{tech.battery}%</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden">
          <MapContainer center={[24.7136, 46.6753]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="Google Satellite" />
            {technicians.map((tech) => (
              <Marker key={tech.user_id} position={[tech.lat, tech.lng]} icon={defaultIcon}>
                <Popup>
                  <div className="text-right">
                    <div className="font-bold">{tech.full_name}</div>
                    <div className="text-sm text-gray-500">{getStatusText(tech)}</div>
                    <div className="mt-2 text-xs">
                      <div>البطارية: {tech.battery}%</div>
                      <div>الإشارة: {tech.signal_dbm} dBm</div>
                      <div>آخر تحديث: {new Date(tech.last_update).toLocaleTimeString('ar-SA')}</div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
