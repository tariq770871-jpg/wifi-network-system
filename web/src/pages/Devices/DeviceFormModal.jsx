import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { devicesApi } from '../../services/devices.service'
import LocationPicker from './LocationPicker'
import toast from 'react-hot-toast'
import { X, Router, Loader2 } from 'lucide-react'

const DEVICE_TYPES = [
  { value: 'router', label: 'راوتر' },
  { value: 'switch', label: 'سويتش' },
  { value: 'access_point', label: 'نقطة وصول' },
  { value: 'antenna', label: 'هوائي' },
  { value: 'other', label: 'أخرى' },
]
const STATUSES = [
  { value: 'online', label: 'متصل' },
  { value: 'offline', label: 'غير متصل' },
  { value: 'maintenance', label: 'صيانة' },
]
const COORD_SOURCES = [
  { value: 'gps', label: 'GPS' },
  { value: 'manual', label: 'يدوي' },
  { value: 'mikrotik', label: 'MikroTik' },
]

const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/60 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all'

const EMPTY = {
  name: '', device_type: 'router', model: '', manufacturer: '', serial_number: '',
  mac_address: '', ip_address: '', status: 'offline', notes: '',
  location: null, // { lat, lng, source, accuracy }
  installed_at: '', is_mikrotik_linked: false, mikrotik_username: 'monitor',
  mikrotik_api_port: 8728, mikrotik_password: '',
}

/** نموذج إضافة/تعديل جهاز — كل بيانات الجهاز + منتقي الموقع GPS/يدوي */
export default function DeviceFormModal({ device, onClose, canEdit }) {
  const isEdit = !!device
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const queryClient = useQueryClient()

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name || '',
        device_type: device.device_type || 'router',
        model: device.model || '',
        manufacturer: device.manufacturer || '',
        serial_number: device.serial_number || '',
        mac_address: device.mac_address || '',
        ip_address: device.ip_address || '',
        status: device.status || 'offline',
        notes: device.notes || '',
        location: device.location_lat != null && device.location_lng != null
          ? {
              lat: device.location_lat,
              lng: device.location_lng,
              source: device.coordinate_source || 'manual',
              accuracy: device.gps_accuracy ?? null,
            }
          : null,
        installed_at: device.installed_at ? String(device.installed_at).slice(0, 10) : '',
        is_mikrotik_linked: !!device.is_mikrotik_linked,
        mikrotik_username: device.mikrotik_username || 'monitor',
        mikrotik_api_port: device.mikrotik_api_port || 8728,
        mikrotik_password: '', // لا تُعرض أبداً — تُكتب فقط عند التغيير
      })
    }
  }, [device])

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit ? devicesApi.update(device.id, payload) : devicesApi.create(payload)),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success(resp?.message || (isEdit ? 'تم تحديث الجهاز' : 'تمت إضافة الجهاز'))
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء الحفظ', { duration: 6000 }),
  })

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handlePick = (loc) => {
    setForm((f) => ({
      ...f,
      location: loc,
      // الدقة تُحفظ تلقائياً مع مصدر GPS
      ...(loc.source === 'gps' ? {} : {}),
    }))
    setErrors((e) => ({ ...e, location: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'اسم الجهاز مطلوب'
    if (form.ip_address && !/^\d{1,3}(\.\d{1,3}){3}$/.test(form.ip_address) && !form.ip_address.includes(':')) {
      e.ip_address = 'عنوان IP غير صالح'
    }
    const mac = form.mac_address.trim()
    if (mac && !/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(mac)) {
      e.mac_address = 'الصيغة المطلوبة AA:BB:CC:DD:EE:FF'
    }
    if (form.is_mikrotik_linked && !form.ip_address.trim()) {
      e.ip_address = 'عنوان IP مطلوب لربط MikroTik'
    }
    if (form.location?.source !== 'gps' && form.location) {
      // تحديد يدوي — لا دقة
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = (ev) => {
    ev.preventDefault()
    if (!validate()) {
      toast.error('أكمل الحقول المطلوبة')
      return
    }
    const payload = {
      name: form.name.trim(),
      device_type: form.device_type,
      model: form.model.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      serial_number: form.serial_number.trim() || null,
      mac_address: form.mac_address.trim() || null,
      ip_address: form.ip_address.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      location_lat: form.location?.lat ?? null,
      location_lng: form.location?.lng ?? null,
      // مصدر الإحداثية + الدقة: GPS يحفظ الدقة المقاسة، اليدوي بلا دقة
      coordinate_source: form.location ? form.location.source : null,
      gps_accuracy: form.location?.source === 'gps' ? form.location.accuracy : null,
      installed_at: form.installed_at || null,
      is_mikrotik_linked: form.is_mikrotik_linked,
      mikrotik_username: form.mikrotik_username,
      mikrotik_api_port: Number(form.mikrotik_api_port) || 8728,
      ...(form.mikrotik_password ? { mikrotik_password: form.mikrotik_password } : {}),
    }
    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isEdit ? 'تعديل جهاز' : 'إضافة جهاز'}>
      <div className="absolute inset-0 bg-black/50 modal-backdrop" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-fade-in-scale">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="gradient-primary p-2 rounded-lg text-white"><Router size={18} /></div>
            <h2 className="font-bold text-gray-900 dark:text-white">{isEdit ? `تعديل الجهاز: ${device?.name}` : 'إضافة جهاز جديد'}</h2>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* البيانات الأساسية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">اسم الجهاز *</label>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="مثال: راوتر الحي الرئيسي" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">نوع الجهاز</label>
              <select className={inputCls} value={form.device_type} onChange={(e) => set('device_type', e.target.value)}>
                {DEVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">الموديل</label>
              <input className={inputCls} value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="مثال: hAP ac²" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">الشركة المصنّعة</label>
              <input className={inputCls} value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="مثال: MikroTik" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">الرقم التسلسلي</label>
              <input className={inputCls} value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="مثال: HEE8-XXXX" dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">عنوان MAC</label>
              <input className={inputCls} value={form.mac_address} onChange={(e) => set('mac_address', e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" dir="ltr" />
              {errors.mac_address && <p className="text-xs text-red-500 mt-1">{errors.mac_address}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">عنوان IP</label>
              <input className={inputCls} value={form.ip_address} onChange={(e) => set('ip_address', e.target.value)} placeholder="192.168.88.1" dir="ltr" />
              {errors.ip_address && <p className="text-xs text-red-500 mt-1">{errors.ip_address}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">الحالة</label>
              <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">تاريخ التركيب</label>
              <input type="date" className={inputCls} value={form.installed_at} onChange={(e) => set('installed_at', e.target.value)} />
            </div>
          </div>

          {/* الموقع */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
              موقع الجهاز
              {form.location?.source === 'gps' && form.location.accuracy != null && (
                <span className="text-emerald-600 dark:text-emerald-400 font-normal"> — دقة GPS: ±{form.location.accuracy}م</span>
              )}
            </label>
            <LocationPicker value={form.location} onPick={handlePick} />
            {form.location && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono" dir="ltr">
                  {form.location.lat.toFixed(6)}, {form.location.lng.toFixed(6)}
                </span>
                <button type="button" onClick={() => set('location', null)} className="text-xs text-red-500 hover:underline">
                  إزالة الموقع
                </button>
              </div>
            )}
          </div>

          {/* MikroTik */}
          <div className="border border-gray-100 dark:border-gray-700/50 rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_mikrotik_linked}
                onChange={(e) => set('is_mikrotik_linked', e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">ربط بجهاز MikroTik (مراقبة حية)</span>
            </label>
            {form.is_mikrotik_linked && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">مستخدم API</label>
                  <input className={inputCls} value={form.mikrotik_username} onChange={(e) => set('mikrotik_username', e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">منفذ API</label>
                  <input type="number" min="1" max="65535" className={inputCls} value={form.mikrotik_api_port} onChange={(e) => set('mikrotik_api_port', e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                    كلمة المرور {isEdit && <span className="font-normal text-gray-400">(اتركها فارغة للإبقاء)</span>}
                  </label>
                  <input type="password" className={inputCls} value={form.mikrotik_password} onChange={(e) => set('mikrotik_password', e.target.value)} dir="ltr" autoComplete="new-password" />
                </div>
              </div>
            )}
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">ملاحظات</label>
            <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="أي تفاصيل إضافية عن الجهاز أو التركيب…" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/25 transition-all disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'حفظ التعديلات' : 'إضافة الجهاز'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
