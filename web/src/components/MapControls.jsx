import { useState, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { Crosshair, Layers, Satellite, Map as MapIcon, Loader2 } from 'lucide-react'
import L from '../lib/leaflet-setup'

// Custom icon for user location marker
const userLocationIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#1976D2;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(25,118,210,0.5);"></div>
         <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;background:rgba(25,118,210,0.15);border-radius:50%;"></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: '',
})

/** Locate Me button - centers map on user's GPS position */
export function LocateControl() {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  const [located, setLocated] = useState(false)
  const markerRef = useRef(null)

  const handleLocate = () => {
    if (!navigator.geolocation) {
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        map.flyTo([latitude, longitude], 16, { duration: 1.2 })
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude])
        } else {
          markerRef.current = L.marker([latitude, longitude], { icon: userLocationIcon }).addTo(map)
        }
        setLocated(true)
        setLocating(false)
      },
      () => {
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 10, right: 10 }}>
      <div className="leaflet-control bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={handleLocate}
          disabled={locating}
          className={`flex items-center justify-center w-10 h-10 transition-colors ${
            locating ? 'text-gray-400 cursor-wait' :
            located ? 'text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10' :
            'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title="موقعي الحالي"
        >
          {locating ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
        </button>
      </div>
    </div>
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