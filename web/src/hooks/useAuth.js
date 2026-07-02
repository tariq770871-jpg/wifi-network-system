import { create } from 'zustand'
import { authApi } from '../services/auth.service'

function getStorage(remember) {
  return remember ? localStorage : sessionStorage
}

function getStoredAuth() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token')
  const userJson = localStorage.getItem('user') || sessionStorage.getItem('user')
  let user = null
  try { user = JSON.parse(userJson) } catch {}
  return { token, user, isAuthenticated: !!token }
}

const { token: initToken, user: initUser, isAuthenticated: initAuth } = getStoredAuth()

export const useAuthStore = create((set, get) => ({
  user: initUser,
  token: initToken,
  isAuthenticated: initAuth,
  loading: false,
  error: null,

  login: async (username, password, rememberMe = true) => {
    set({ loading: true, error: null })
    try {
      const response = await authApi.login(username, password)
      const { token, user } = response.data
      const storage = getStorage(rememberMe)
      storage.setItem('token', token)
      storage.setItem('user', JSON.stringify(user))
      const other = rememberMe ? sessionStorage : localStorage
      other.removeItem('token')
      other.removeItem('user')
      if (rememberMe) {
        localStorage.setItem('saved_username', username)
      } else {
        localStorage.removeItem('saved_username')
      }
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
    localStorage.removeItem('saved_username')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  fetchUser: async () => {
    try {
      const response = await authApi.me()
      set({ user: response.data })
      const storage = localStorage.getItem('token') ? localStorage : sessionStorage
      storage.setItem('user', JSON.stringify(response.data))
    } catch {
      get().logout()
    }
  },
}))