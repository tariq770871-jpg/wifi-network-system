import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, ChevronDown, Settings2, Plus, X, Pencil, Trash2, Loader2 } from 'lucide-react'
import { sitesApi } from '../services/sites.service'
import { useSiteStore } from '../hooks/useSiteStore'
import { useAuthStore } from '../hooks/useAuth'
import { toast } from 'react-hot-toast'

// FEATURE: مبدّل الشبكات — قائمة منسدلة أعلى الشاشة
// يظهر في كل الصفحات، ويغير فلترة البلاغات والأجهزة فوراً (مفاتيح react-query تتضمن الشبكة)
// MULTI-NETWORK: الأدمن يدير الشبكات (إضافة/تعديل/حذف) من زر الإدارة بجوار القائمة
export default function SiteSwitcher() {
  const { selectedSiteId, setSelectedSiteId } = useSiteStore()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const [manageOpen, setManageOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
    staleTime: 5 * 60 * 1000, // القائمة ثابتة نسبياً — لا حاجة لإعادة الجلب مع كل تنقل
  })
  const sites = Array.isArray(data?.data?.items) ? data.data.items : []

  const current = sites.find((s) => String(s.id) === String(selectedSiteId))

  return (
    <div className="relative flex items-center">
      <Network size={15} className="text-primary pointer-events-none" />
      <select
        value={String(selectedSiteId)}
        onChange={(e) => setSelectedSiteId(e.target.value === 'all' ? 'all' : e.target.value)}
        className="appearance-none bg-transparent pr-1.5 pl-6 py-1.5 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer outline-none focus:ring-2 focus:ring-primary/40 max-w-[180px] truncate"
        aria-label="التنقل بين الشبكات"
        title={current ? `الشبكة الحالية: ${current.name}` : 'كل الشبكات'}
      >
        <option value="all">كل الشبكات</option>
        {sites.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.name}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="text-gray-400 pointer-events-none -mr-4" />
      {isAdmin && (
        <button
          onClick={() => setManageOpen(true)}
          className="p-1.5 mr-1 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
          title="إدارة الشبكات (إضافة/تعديل/حذف)"
          aria-label="إدارة الشبكات"
        >
          <Settings2 size={15} />
        </button>
      )}
      {manageOpen && (
        <SiteManageModal
          sites={sites}
          onClose={() => setManageOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['sites'] })}
          onSelect={(id) => setSelectedSiteId(String(id))}
        />
      )}
    </div>
  )
}

// نافذة إدارة الشبكات — للأدمن فقط: إضافة/تعديل/حذف الشبكات (المواقع)
function SiteManageModal({ sites, onClose, onSaved, onSelect }) {
  const { selectedSiteId, setSelectedSiteId } = useSiteStore()
  const queryClient = useQueryClient()
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', location: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const openAdd = () => {
    setEditId(null)
    setForm({ name: '', location: '', notes: '' })
  }

  const startEdit = (site) => {
    setEditId(site.id)
    setForm({ name: site.name || '', location: site.location || '', notes: site.notes || '' })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (editId) {
        await sitesApi.update(editId, payload)
        toast.success('تم تعديل الشبكة')
      } else {
        const res = await sitesApi.create(payload)
        const created = res?.data ?? res
        if (created?.id) {
          onSelect(created.id)
          toast.success('تمت إضافة الشبكة')
        }
      }
      setEditId(null)
      setForm({ name: '', location: '', notes: '' })
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'تعذر حفظ الشبكة')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (site) => {
    if (!window.confirm(`حذف الشبكة «${site.name}»؟ البلاغات والأجهزة المرتبطة ستبقى موجودة لكن بدون شبكة.`)) return
    try {
      await sitesApi.delete(site.id)
      if (String(selectedSiteId) === String(site.id)) setSelectedSiteId('all')
      toast.success('تم حذف الشبكة')
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'تعذر حذف الشبكة')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">إدارة الشبكات</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        {/* قائمة الشبكات الحالية */}
        <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1 mb-4">
          {sites.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">لا توجد شبكات بعد — أضف أول شبكة من النموذج أدناه</p>
          )}
          {sites.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                String(selectedSiteId) === String(s.id)
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{s.name}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {s.location || 'بدون موقع'} — {s.devices_count ?? 0} جهاز · {s.tickets_count ?? 0} بلاغ
                </p>
              </div>
              <button
                onClick={() => startEdit(s)}
                className="p-1.5 rounded text-gray-400 hover:text-primary shrink-0"
                title="تعديل"
                aria-label={`تعديل ${s.name}`}
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => remove(s)}
                className="p-1.5 rounded text-gray-400 hover:text-red-500 shrink-0"
                title="حذف"
                aria-label={`حذف ${s.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* نموذج إضافة/تعديل */}
        <form onSubmit={save} className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {editId ? 'تعديل الشبكة' : 'إضافة شبكة جديدة'}
            </h4>
            {editId && (
              <button type="button" onClick={openAdd} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus size={12} /> شبكة جديدة بدلاً من التعديل
              </button>
            )}
          </div>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={100}
            placeholder="اسم الشبكة * — مثال: شبكة المسجد الكبير"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            maxLength={255}
            placeholder="الموقع (اختياري) — مثال: الرياض - حي النرجس"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            maxLength={1000}
            placeholder="ملاحظات (اختياري)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="w-full py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editId ? 'حفظ التعديل' : 'إضافة الشبكة'}
          </button>
        </form>
      </div>
    </div>
  )
}
