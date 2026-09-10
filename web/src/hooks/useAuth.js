import { create } from 'zustand'
import { authApi } from '../services/auth.service'

// SECURITY: لا توكن في التخزين المحلي — الجلسة تعيش في كوكي HttpOnly يضبطها الخادم.
// نخزن بيانات العرض فقط (الاسم/الدور) لتجنب وميض الواجهة عند الإقلاع.

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')) || null } catch { return null }
}

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  loading: false,
  error: null,

  login: async (username, password, rememberMe = true) => {
    set({ loading: true, error: null })
    try {
      // الخادم يضبط كوكي HttpOnly في استجابة هذا الطلب (withCredentials)
      const response = await authApi.login(username, password, rememberMe)
      const { user } = response.data
      localStorage.setItem('user', JSON.stringify(user))
      sessionStorage.removeItem('user')
      if (rememberMe) {
        localStorage.setItem('saved_username', username)
      } else {
        localStorage.removeItem('saved_username')
      }
      set({ user, isAuthenticated: true, loading: false })
      window.location.href = '/'
      return true
    } catch (err) {
      set({ error: err.response?.data?.error || 'خطأ في تسجيل الدخول', loading: false })
      return false
    }
  },

  logout: async () => {
    try { await authApi.logout() } catch { /* حتى لو فشل الطلب نمسح محلياً */ }
    localStorage.removeItem('user')
    localStorage.removeItem('saved_username')
    sessionStorage.removeItem('user')
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  // التحقق من الجلسة عند الإقلاع: الكوكي هو مصدر الحقيقة
  fetchUser: async () => {
    try {
      const response = await authApi.me()
      localStorage.setItem('user', JSON.stringify(response.data))
      set({ user: response.data, isAuthenticated: true })
      return response.data
    } catch {
      if (get().isAuthenticated) get().logout()
      return null
    }
  },
}))
