import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { sitesApi } from '../../services/sites.service'
import { useAuthStore } from '../../hooks/useAuth'
import { useSiteStore } from '../../hooks/useSiteStore'
import toast from 'react-hot-toast'
import { Network, Plus, Pencil, Trash2, X, Loader2, Inbox, Ticket, Router, MapPin, Eye } from 'lucide-react'

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-gray-400'

// FEATURE: الشبكات/المواقع — إدارة الشبكات (مجموعات العمل)
// القراءة لكل الأدوار؛ الإضافة/التعديل/الحذف للمدير فقط (مفروضة في الخلفية)
function SiteFormModal({ site, onClose }) {
  const isEdit = !!site
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: site?.name || '',
    location: site?.location || '',
    notes: site?.notes || '',
    is_active: site ? site.is_active !== false : true,
  })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (data) => (isEdit ? sitesApi.update(site.id, data) : sitesApi.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success(isEdit ? 'تم تحديث الشبكة' : 'تم إنشاء الشبكة — اختَرها من المبدّل أعلى الشاشة')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'حدث خطأ أثناء الحفظ'),
  })

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('اسم الشبكة مطلوب')
    mutation.mutate({
      name: form.name.trim(),
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 modal-backdrop" onClick={onClose} />
      <div className="relative card w-full max-w-md animate-fade-in-scale" role="dialog" aria-modal="true" aria-label={isEdit ? 'تعديل شبكة' : 'إضافة شبكة'}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Network size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{isEdit ? 'تعديل الشبكة' : 'شبكة جديدة'}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">موقع تشغيل مستقل له بلاغاته وأجهزته</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">اسم الشبكة *</label>
            <input
              type="text" value={form.name} onChange={set('name')}
              placeholder="مثال: شبكة حي الجامعة"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">الموقع</label>
            <input
              type="text" value={form.location} onChange={set('location')}
              placeholder="المدينة / الحي / وصف مختصر"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ملاحظات</label>
            <textarea
              value={form.notes} onChange={set('notes')} rows={3}
              placeholder="تفاصيل الشبكة، الأجهزة الرئيسية، جهة الاتصال..."
              className={`${inputCls} resize-none`}
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">شبكة نشطة (تظهر في المبدّل ونماذج البلاغات)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="submit" disabled={mutation.isPending}
              className="flex-1 gradient-primary text-white py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {isEdit ? 'حفظ التعديلات' : 'إنشاء الشبكة'}
            </button>
            <button
              type="button" onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SitesPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setSelectedSiteId } = useSiteStore()
  const [formTarget, setFormTarget] = useState(null) // null | 'new' | site

  // الصفحة الإدارية تعرض الكل (النشط وغير النشط)
  const { data, isLoading } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => sitesApi.getAll({ include_inactive: 'true' }),
  })
  const sites = Array.isArray(data?.data?.items) ? data.data.items : []

  const deleteMutation = useMutation({
    mutationFn: (id) => sitesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success('تم حذف الشبكة')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'تعذر حذف الشبكة', { duration: 6000 }),
  })

  const viewTickets = (site) => {
    setSelectedSiteId(String(site.id))
    navigate('/tickets')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الشبكات</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            مواقع التشغيل المختلفة — كل شبكة تضم بلاغاتها وأجهزتها، والتنقل بينها من المبدّل أعلى الشاشة
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setFormTarget('new')}
            className="gradient-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={17} />
            إضافة شبكة
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : sites.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mx-auto mb-3">
            <Inbox size={28} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">لا توجد شبكات بعد</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {isAdmin ? 'أضف أول شبكة لتتمكن من تجميع البلاغات والأجهزة حسب الموقع' : 'لم ينشئ المدير أي شبكات بعد'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sites.map((s, idx) => (
            <div
              key={s.id}
              className="card p-4 hover:shadow-lg transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${idx * 0.03}s` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-lg text-white shadow-sm flex-shrink-0 ${s.is_active !== false ? 'gradient-primary' : 'bg-gray-400'}`}>
                    <Network size={17} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{s.name}</h3>
                    {s.location && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {s.location}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                  s.is_active !== false
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
                    : 'bg-gray-100 text-gray-500 ring-1 ring-gray-400/20 dark:bg-gray-700/50 dark:text-gray-400 dark:ring-gray-600/20'
                }`}>
                  {s.is_active !== false ? 'نشطة' : 'موقوفة'}
                </span>
              </div>

              {s.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2" title={s.notes}>{s.notes}</p>
              )}

              {/* العدادات */}
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  <Ticket size={12} /> {s.tickets_count ?? 0} بلاغ
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                  <Router size={12} /> {s.devices_count ?? 0} جهاز
                </span>
              </div>

              {/* الإجراءات */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-1.5">
                <button
                  onClick={() => viewTickets(s)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  title="فلترة البلاغات على هذه الشبكة"
                >
                  <Eye size={12} /> عرض البلاغات
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setFormTarget(s)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Pencil size={12} /> تعديل
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`حذف الشبكة "${s.name}"؟`)) deleteMutation.mutate(s.id) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors mr-auto"
                    >
                      <Trash2 size={12} /> حذف
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget && (
        <SiteFormModal
          site={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}
    </div>
  )
}
