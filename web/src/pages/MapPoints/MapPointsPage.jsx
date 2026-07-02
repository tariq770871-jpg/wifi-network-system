import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mapPointsApi } from '../../services/mapPoints.service'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Check, X, MapPin, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const statusColors = {
  pending: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const statusLabels = {
  pending: 'بانتظار الموافقة',
  approved: 'معتمد',
  rejected: 'مرفوض',
}

export default function MapPointsPage() {
  const [filter, setFilter] = useState('pending')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery(['map-points', filter], () =>
    mapPointsApi.getAll(filter ? { status: filter } : {})
  )

  const reviewMutation = useMutation(
    ({ id, status }) => mapPointsApi.review(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('map-points')
        toast.success('تمت المراجعة بنجاح')
      },
      onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
    }
  )

  // api.js interceptor returns response.data = { success, data: [...] }
  const points = Array.isArray(data?.data) ? data.data : []
  const approvedPoints = points.filter(p => p.status === 'approved')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">نقاط الخريطة</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="text-sm text-gray-500">بانتظار المراجعة</div>
          <div className="text-2xl font-bold text-orange-600">
            {points.filter(p => p.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="text-sm text-gray-500">معتمدة</div>
          <div className="text-2xl font-bold text-green-600">
            {points.filter(p => p.status === 'approved').length}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="text-sm text-gray-500">مرفوضة</div>
          <div className="text-2xl font-bold text-red-600">
            {points.filter(p => p.status === 'rejected').length}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        {['all', 'pending', 'approved', 'rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status === 'all' ? '' : status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (status === 'all' && !filter) || filter === status
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border'
            }`}
          >
            {status === 'all' ? 'الكل' : statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Points List */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold">الطلبات</h2>
          </div>
          <div className="divide-y max-h-[500px] overflow-auto">
            {isLoading ? (
              <div className="p-8 text-center">جاري التحميل...</div>
            ) : points.length === 0 ? (
              <div className="p-8 text-center text-gray-500">لا توجد نقاط</div>
            ) : (
              points.map((point) => (
                <div key={point.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{point.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        <MapPin size={14} className="inline ml-1" />
                        {point.location_lat?.toFixed(5)}, {point.location_lng?.toFixed(5)}
                      </div>
                      {point.note && (
                        <div className="text-sm text-gray-600 mt-1">{point.note}</div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>بواسطة: {point.creator_name || '-'}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {point.created_at ? new Date(point.created_at).toLocaleDateString('ar-SA') : '-'}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[point.status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabels[point.status] || point.status}
                    </span>
                  </div>
                  {point.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => reviewMutation.mutate({ id: point.id, status: 'approved' })}
                        className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600"
                      >
                        <Check size={14} />
                        موافقة
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate({ id: point.id, status: 'rejected' })}
                        className="flex items-center gap-1 bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600"
                      >
                        <X size={14} />
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
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden h-[500px]">
          <MapContainer
            center={[24.7136, 46.6753]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            {approvedPoints.map((point) => (
              point.location_lat && point.location_lng && (
                <Marker
                  key={point.id}
                  position={[point.location_lat, point.location_lng]}
                >
                  <Popup>
                    <div className="text-right">
                      <div className="font-bold">{point.name}</div>
                      {point.note && <div className="text-sm">{point.note}</div>}
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
