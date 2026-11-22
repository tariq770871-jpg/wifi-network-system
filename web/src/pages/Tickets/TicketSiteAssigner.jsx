import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2, X, Loader2 } from 'lucide-react'
import { useSiteStore } from '../../hooks/useSiteStore'
import { useAuthStore } from '../../hooks/useAuth'
import { ticketsApi } from '../../services/tickets.service'
import { sitesApi } from '../../services/sites.service'
import { toast } from 'react-hot-toast'

// MULTI-NETWORK: أداة الأدمن/الدعم — ربط البلاغات القديمة (غير المصنفة بشبكة)
// بالشبكة المختارة حالياً. تظهر فقط عند اختيار شبكة من المبدّل أعلى الشاشة،
// وتجلب البلاغات ذات site_id فارغ عبر site_id=0 (الخادم يفهمها: غير المرتبطة فقط).
export default function TicketSiteAssigner() {
  const { selectedSiteId } = useSiteStore()
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  const role = user?.role
  const canManage = role === 'admin' || role === 'support'
  const isSiteSelected = selectedSiteId !== 'all' && selectedSiteId != null

  const { data: sitesRaw } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
    enabled: canManage && isSiteSelected && open,
    staleTime: 5 * 60 * 1000,
  })
  const site = (Array.isArray(sitesRaw?.data?.items) ? sitesRaw.data.items : [])
    .find((s) => String(s.id) === String(selectedSiteId))

  // جلب البلاغات غير المرتبطة بأي شبكة (site_id=0 → IS NULL في الخادم)
  const { data: ticketsRaw, refetch, isFetching } = useQuery({
    queryKey: ['tickets', 'uncategorized'],
    queryFn: () => ticketsApi.getAll({ site_id: 0, page: 1, limit: 100 }),
    enabled: canManage && isSiteSelected && open,
  })
  const items = Array.isArray(ticketsRaw?.data?.items) ? ticketsRaw.data.items : []

  if (!canManage || !isSiteSelected) return null

  const toggle = (id) => setPicked((p) => ({ ...p, [id]: !p[id] }))

  const assignPicked = async () => {
    const ids = Object.keys(picked).filter((k) => picked[k])
    if (!ids.length || busy) return
    setBusy(true)
    let ok = 0
    for (const id of ids) {
      try {
        await ticketsApi.setSite(id, Number(selectedSiteId))
        ok += 1
      } catch (err) {
        toast.error(err?.response?.data?.error || `تعذر ربط البلاغ رقم ${id}`)
      }
    }
    setBusy(false)
    setPicked({})
    setDoneCount(ok)
    await refetch()
    if (ok) toast.success(`تم ربط ${ok} بلاغ بالشبكة «${site?.name || ''}»`)
  }

  const pickedCount = Object.values(picked).filter(Boolean).length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all duration-200"
        title="ربط البلاغات غير المصنفة بالشبكة المختارة"
      >
        <Link2 size={14} />
        ربط البلاغات القديمة بـ«{site?.name || 'الشبكة'}»
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                بلاغات بدون شبكة → «{site?.name || ''}»
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>

            {doneCount > 0 && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                تم ربط {doneCount} بلاغ بالشبكة «{site?.name || ''}» بنجاح
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
              {(isFetching || !ticketsRaw) && (
                <p className="text-xs text-gray-400 py-6 text-center flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> جارٍ التحميل...
                </p>
              )}
              {!isFetching && ticketsRaw && items.length === 0 && (
                <p className="text-xs text-gray-400 py-6 text-center">لا توجد بلاغات بدون شبكة — كل البلاغات مصنفة</p>
              )}
              {!isFetching &&
                items.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={!!picked[t.id]}
                      onChange={() => toggle(t.id)}
                      className="w-4 h-4 shrink-0"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{t.title}</span>
                      <span className="block text-[11px] text-gray-400 truncate">
                        {t.customer_name || ''}
                        {t.created_at ? ` — ${String(t.created_at).slice(0, 10)}` : ''}
                      </span>
                    </span>
                  </label>
                ))}
            </div>

            <div className="pt-3">
              <button
                onClick={assignPicked}
                disabled={busy || !pickedCount}
                className="w-full py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {busy ? 'جارٍ الربط...' : `ربط المحدد (${pickedCount}) بالشبكة`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
