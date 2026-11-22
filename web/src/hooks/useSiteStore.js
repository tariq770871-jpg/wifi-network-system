import { create } from 'zustand'

// FEATURE: الشبكات/المواقع — متجر الشبكة المختارة عالمياً
// 'all' = كل الشبكات، أو معرف الشبكة كنص
// - selectedSiteId يُحفظ في localStorage ليظل آخر اختيار بين الجلسات
// - gatePassed: بواب اختيار الشبكة — يبدأ false عند كل فتح جديد للتطبيق،
//   فتظهر شاشة «اختر الشبكة» أولاً وبعد الاختيار يدخل المستخدم للتطبيق
const KEY = 'selected_site_id'

function getStored() {
  try {
    const v = localStorage.getItem(KEY)
    return v && v !== '' ? v : 'all'
  } catch {
    return 'all'
  }
}

export const useSiteStore = create((set) => ({
  selectedSiteId: getStored(),
  gatePassed: false,
  setSelectedSiteId: (id) => {
    try {
      localStorage.setItem(KEY, id === 'all' ? '' : String(id))
    } catch { /* التخزين غير متاح — نكمل بالذاكرة فقط */ }
    // الاختيار (من شاشة البوابة أو من المبدّل في الهيدر) يعبر البوابة دائماً
    set({ selectedSiteId: id, gatePassed: true })
  },
}))
