import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mapPointsApi } from '../../services/mapPoints.service'
import { useAuthStore } from '../../hooks/useAuth'
import { MapContainer, Marker, Popup, useMapEvents } from 'react-leaflet'
import { Check, X, MapPin, Clock, Loader2, Inbox, Map, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import L from '../../lib/leaflet-setup'
import { LocateControl, LayerToggle } from '../../components/MapControls'

const statusColors = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
}
const statusLabels = { pending: 'بانتظار الموافقة', approved: 'معتمد', rejected: 'مرفوض' }

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

export default function MapPointsPage() {
  const { user } = useAuthStore()
  const canReview = user?.role === 'admin' || user?.role === 'support'
  const [filter, setFilter] = useState('pending')
  const [addMode, setAddMode] = useState(false)
  const [newPoint, setNewPoint] = useState(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['map-points', filter],
    queryFn: () => mapPointsApi.getAll(filter ? { status: filter } : {})
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }) => mapPointsApi.review(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['map-points'] })
      toast.success('تمت المراجعة بنجاح')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ'),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => mapPointsApi.create(payload),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['map-points'] })
      toast.success(resp?.message || 'تمت إضافة النقطة بنجاح')
      setNewPoint(null)
      setName('')
      setNote('')
      setAddMode(false)
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء الإضافة'),
  })

  const submitNewPoint = () => {
    if (!name.trim()) {
      toast.error('اسم النقطة مطلوب')
      return
    }
    createMutation.mutate({
      name: name.trim(),
      note: note.trim() || undefined,
      location_lat: newPoint.lat,
      location_lng: newPoint.lng,
    })
  }

  const points = Array.isArray(data?.data) ? data.data : []
  const approvedPoints = points.filter(p => p.status === 'approved')

  const statItems = [
    { label: 'بانتظار المراجعة', color: 'text-amber-600 dark:text-amber-400', status: 'pending', gradient: 'gradient-orange' },
    { label: 'معتمدة', color: 'text-emerald-600 dark:text-emerald-400', status: 'approved', gradient: 'gradient-green' },
    { label: 'مرفوضة', color: 'text-red-600 dark:text-red-400', status: 'rejected', gradient: 'gradient-red' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">نقاط الخريطة</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">إدارة ومراجعة نقاط الشبكة على الخريطة</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
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
              {newPoint ? 'أكمل البيانات في النموذج' : 'انقر على الخريطة في موضع النقطة الجديدة'}
            </div>
          )}
          <MapContainer center={[24.7136, 46.6753]} zoom={13} style={{ height: '100%', width: '100%' }} className="z-10">
            <MapClickCatcher active={addMode && !newPoint} onSelect={setNewPoint} />
            <LocateControl />
            <LayerToggle />
            {newPoint && <Marker position={[newPoint.lat, newPoint.lng]} icon={newPointIcon} />}
            {approvedPoints.filter(p => p.location_lat && p.location_lng).map(p => (
              <Marker key={p.id} position={[p.location_lat, p.location_lng]}>
                <Popup>
                  <div className="text-right min-w-[150px]">
                    <div className="font-bold text-sm">{p.name}</div>
                    {p.note && <div className="text-xs text-gray-500 mt-1">{p.note}</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Add Point Modal */}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">اسم النقطة / الجهاز *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNewPoint()}
              placeholder="مثال: راوتر حي النزهة"
              className="input-field w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 mb-4"
            />
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ملاحظات (اختياري)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="وصف الموقع، نوع الجهاز، حالة التغطية..."
              className="input-field w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400 mb-5 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={submitNewPoint}
                disabled={createMutation.isPending || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                حفظ النقطة
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