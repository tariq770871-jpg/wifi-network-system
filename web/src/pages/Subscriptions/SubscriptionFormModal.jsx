import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionsApi } from '../../services/subscriptions.service'
import { devicesApi } from '../../services/devices.service'
import toast from 'react-hot-toast'
import {
  X, Loader2, CalendarDays, Phone, MapPin, StickyNote
} from 'lucide-react'

const planLabels = { basic: 'أساسي', standard: 'قياسي', premium: 'مميز', custom: 'مخصص' }

const statusLabels = { active: 'نشط', expired: 'منتهي', suspended: 'موقوف', cancelled: 'ملغي' }

// ISO (yyyy-mm-dd) لتاريخ اليوم — إدخال date
const todayISO = () => new Date().toISOString().slice(0, 10)

export default function SubscriptionFormModal({ subscription, onClose }) {
  const isEdit = Boolean(subscription?.id)
  const queryClient = useQueryClient()

  const [form, setForm] = useState(() => ({
    customer_name: subscription?.customer_name || '',
    customer_phone: subscription?.customer_phone || '',
    customer_address: subscription?.customer_address || '',
    device_id: subscription?.device_id || '',
    plan: subscription?.plan || 'basic',
    monthly_price: subscription?.monthly_price ?? '',
    start_date: subscription?.start_date ? String(subscription.start_date).slice(0, 10) : todayISO(),
    end_date: subscription?.end_date ? String(subscription.end_date).slice(0, 10) : '',
    status: subscription?.status || 'active',
    notes: subscription?.notes || '',
  }))

  // أجهزة النظام لربط الاشتراك بجهاز (اختياري) — القائمة موحدة مع تبويب الأجهزة
  const { data: devicesData } = useQuery({
    queryKey: ['devices', 'options'],
    queryFn: () => devicesApi.getAll({ limit: 500 }),
    staleTime: 30_000,
  })
  const devices = Array.isArray(devicesData?.data?.items) ? devicesData.data.items : []

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? subscriptionsApi.update(subscription.id, payload) : subscriptionsApi.create(payload),
    onSuccess: () => {
      // مزامنة التبويبات: الاشتراكات + الداشبورد معاً
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(isEdit ? 'تم تحديث الاشتراك' : 'تم إنشاء الاشتراك')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء الحفظ'),
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.customer_name.trim()) return toast.error('اسم العميل مطلوب')
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      return toast.error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء')
    }
    const payload = {
      ...form,
      device_id: form.device_id || null,
      monthly_price: form.monthly_price === '' ? 0 : Number(form.monthly_price),
    }
    if (!isEdit) {
      // إنشاء: انتهاء فارغ → يحدده الخادم (سنة افتراضية)
      if (!form.end_date) delete payload.end_date
    } else {
      // تعديل: انتهاء فارغ → تفريغ صريح (null) — النموذج أدق من الافتراضي هنا
      payload.end_date = form.end_date || null
    }
    saveMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={isEdit ? 'تعديل اشتراك' : 'إضافة اشتراك'}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? `تعديل اشتراك — ${subscription.customer_name}` : 'إضافة اشتراك جديد'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sub-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم العميل *</label>
              <input id="sub-name" value={form.customer_name} onChange={set('customer_name')} required maxLength={100}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" placeholder="مثال: أحمد محمد" />
            </div>
            <div>
              <label htmlFor="sub-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الهاتف</label>
              <div className="relative">
                <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input id="sub-phone" value={form.customer_phone} onChange={set('customer_phone')} maxLength={20} inputMode="tel"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-9 py-2 text-gray-900 dark:text-white" placeholder="07xxxxxxxx" />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="sub-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">العنوان</label>
            <div className="relative">
              <MapPin size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input id="sub-address" value={form.customer_address} onChange={set('customer_address')} maxLength={255}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-9 py-2 text-gray-900 dark:text-white" placeholder="الحي - الشارع" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sub-plan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الخطة</label>
              <select id="sub-plan" value={form.plan} onChange={set('plan')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white">
                {Object.entries(planLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sub-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">السعر الشهري</label>
              <input id="sub-price" type="number" min="0" step="0.5" value={form.monthly_price} onChange={set('monthly_price')} inputMode="decimal"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" placeholder="0" />
            </div>
            <div>
              <label htmlFor="sub-device" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الجهاز المرتبط</label>
              <select id="sub-device" value={form.device_id} onChange={set('device_id')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white">
                <option value="">— بدون —</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sub-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ البدء</label>
              <input id="sub-start" type="date" value={form.start_date} onChange={set('start_date')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label htmlFor="sub-end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ الانتهاء</label>
              <input id="sub-end" type="date" value={form.end_date} onChange={set('end_date')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label htmlFor="sub-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الحالة</label>
              <select id="sub-status" value={form.status} onChange={set('status')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white">
                {Object.entries(statusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sub-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ملاحظات</label>
            <div className="relative">
              <StickyNote size={16} className="absolute right-3 top-3 text-gray-400" aria-hidden="true" />
              <textarea id="sub-notes" value={form.notes} onChange={set('notes')} rows={2} maxLength={1000}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-9 py-2 text-gray-900 dark:text-white" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              إلغاء
            </button>
            <button type="submit" disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CalendarDays size={16} aria-hidden="true" />}
              {isEdit ? 'حفظ التعديلات' : 'إنشاء الاشتراك'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
