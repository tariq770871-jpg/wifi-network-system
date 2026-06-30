import { create } from 'zustand'
import { authApi } from '../services/auth.service'

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const response = await authApi.login(username, password)
      const { token, user } = response.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      set({ user, token, isAuthenticated: true, loading: false })
      window.location.href = '/'
      return true
    } catch (err) {
      set({ error: err.response?.data?.error || 'خطأ في تسجيل الدخول', loading: false })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  fetchUser: async () => {
    try {
      const response = await authApi.me()
      set({ user: response.data })
      localStorage.setItem('user', JSON.stringify(response.data))
    } catch {
      get().logout()
    }
  },
}))
