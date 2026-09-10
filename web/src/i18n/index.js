// i18n الواجهة — بنية قاموس بسيطة قابلة للتوسع
// ----------------------------------------------
// الاستخدام: const t = useT();  t('nav.home')
// اللغة تُحفظ في localStorage (لغة واجهة مستقلة عن لغة الخادم).
// NOTE: قاموس en يغطي هيكل الواجهة (Layout/Login/شائع)؛ باقي الصفحات
// تُستكمل تدريجياً بنفس النمط (المفاتيح المفقودة ترجع للعربية تلقائياً).
import { createContext, useContext } from 'react'

export const dictionaries = {
  ar: {
    'common.loading': 'جارٍ التحميل...',
    'common.checkingSession': 'جارٍ التحقق من الجلسة...',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.close': 'إغلاق',
    'nav.home': 'الرئيسية',
    'nav.tickets': 'البلاغات',
    'nav.tracking': 'التتبع الحي',
    'nav.mapPoints': 'نقاط الخريطة',
    'nav.devices': 'الأجهزة',
    'nav.reports': 'التقارير',
    'nav.users': 'المستخدمين',
    'nav.settings': 'الإعدادات',
    'nav.sidebar': 'القائمة الجانبية',
    'nav.openSidebar': 'فتح القائمة الجانبية',
    'login.title': 'إدارة شبكات WiFi',
    'login.subtitle': 'سجّل دخولك للوصول إلى لوحة التحكم',
    'login.username': 'اسم المستخدم',
    'login.password': 'كلمة المرور',
    'login.remember': 'تذكرني',
    'login.submit': 'تسجيل الدخول',
    'login.secure': 'اتصال آمن',
    'login.showPassword': 'إظهار كلمة المرور',
    'login.hidePassword': 'إخفاء كلمة المرور',
    'app.title': 'لوحة تحكم شبكات WiFi',
    'app.brand': 'WiFi Manager',
    'app.notifications': 'الإشعارات',
    'app.noNotifications': 'لا توجد إشعارات جديدة',
    'app.readAll': 'قراءة الكل',
    'app.logout': 'تسجيل الخروج',
    'app.role.admin': 'مدير النظام',
    'app.role.support': 'دعم فني',
    'app.role.technician': 'فني',
    'app.role.adminShort': 'مدير',
    'app.theme.light': 'الوضع الفاتح',
    'app.theme.dark': 'الوضع الداكن',
    'notfound.title': 'الصفحة غير موجودة',
    'notfound.back': 'العودة للرئيسية',
  },
  en: {
    'common.loading': 'Loading...',
    'common.checkingSession': 'Checking session...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'nav.home': 'Home',
    'nav.tickets': 'Tickets',
    'nav.tracking': 'Live Tracking',
    'nav.mapPoints': 'Map Points',
    'nav.devices': 'Devices',
    'nav.reports': 'Reports',
    'nav.users': 'Users',
    'nav.settings': 'Settings',
    'nav.sidebar': 'Sidebar',
    'nav.openSidebar': 'Open sidebar',
    'login.title': 'WiFi Network Management',
    'login.subtitle': 'Sign in to access the dashboard',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.remember': 'Remember me',
    'login.submit': 'Sign in',
    'login.secure': 'Secure connection',
    'login.showPassword': 'Show password',
    'login.hidePassword': 'Hide password',
    'app.title': 'WiFi Networks Dashboard',
    'app.brand': 'WiFi Manager',
    'app.notifications': 'Notifications',
    'app.noNotifications': 'No new notifications',
    'app.readAll': 'Read all',
    'app.logout': 'Sign out',
    'app.role.admin': 'Administrator',
    'app.role.support': 'Support',
    'app.role.technician': 'Technician',
    'app.role.adminShort': 'Admin',
    'app.theme.light': 'Light mode',
    'app.theme.dark': 'Dark mode',
    'notfound.title': 'Page not found',
    'notfound.back': 'Back to home',
  },
}

const LANG_KEY = 'ui_lang'

export function getInitialLang() {
  if (typeof window === 'undefined') return 'ar'
  const saved = localStorage.getItem(LANG_KEY)
  return saved === 'en' ? 'en' : 'ar' // العربية افتراضياً
}

export function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang === 'en' ? 'en' : 'ar')
  window.dispatchEvent(new CustomEvent('ui-lang-change', { detail: lang }))
}

export function translate(lang, key) {
  return dictionaries[lang]?.[key] ?? dictionaries.ar[key] ?? key
}

// React context (يستهلك عبر useT أسفله)
export const LangContext = createContext({ lang: 'ar', t: (k) => translate('ar', k) })

export function useT() {
  return useContext(LangContext).t
}
