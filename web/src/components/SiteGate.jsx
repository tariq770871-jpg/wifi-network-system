import { useQuery } from '@tanstack/react-query'
import { Network, MapPin, Wifi, Ticket, Router } from 'lucide-react'
import { sitesApi } from '../services/sites.service'
import { useSiteStore } from '../hooks/useSiteStore'

// FEATURE: شاشة اختيار الشبكة — تظهر عند كل فتح جديد للتطبيق
// المستخدم يدخل بحسابه بشكل طبيعي، ثم يختار الشبكة التي سيعمل عليها،
// وبعدها يدخل والتطبيق معزول على بيانات تلك الشبكة (البلاغات والأجهزة والداشبورد)
export default function SiteGate() {
  const { selectedSiteId, setSelectedSiteId } = useSiteStore()

  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
  })
  const sites = Array.isArray(data?.data?.items) ? data.data.items : []

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark flex items-center justify-center p-4">
      <div className="w-full max-w-2xl animate-fade-in">
        {/* الرأس */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
            <Wifi size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">اختر الشبكة</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            اختر الشبكة التي ستعمل عليها الآن — ستعرض بياناتها فقط (البلاغات والأجهزة)
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" role="status" aria-label="جارٍ التحميل" />
          </div>
        ) : sites.length === 0 ? (
          <div className="card p-8 text-center">
            <Network size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">لا توجد شبكات بعد</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              يمكن للمدير إضافة الشبكات من تبويب «الشبكات» في القائمة الجانبية
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sites.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSiteId(String(s.id))}
                className={`card p-4 text-right hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${
                  String(selectedSiteId) === String(s.id) ? 'ring-2 ring-primary' : ''
                }`}
                aria-label={`الدخول إلى شبكة ${s.name}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl text-white shadow-sm flex-shrink-0 ${s.is_active !== false ? 'gradient-primary' : 'bg-gray-400'}`}>
                    <Network size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{s.name}</h3>
                    {s.location && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin size={11} /> {s.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    <Ticket size={10} /> {s.tickets_count ?? 0} بلاغ
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                    <Router size={10} /> {s.devices_count ?? 0} جهاز
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* متابعة بكل الشبكات — بدون عزل */}
        <button
          onClick={() => setSelectedSiteId('all')}
          className="mt-6 w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <Network size={15} />
          عرض كل الشبكات معاً (بدون فصل)
        </button>
      </div>
    </div>
  )
}
