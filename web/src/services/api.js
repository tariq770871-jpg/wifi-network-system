import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

// SECURITY: التوكن لا يُخزن في JS إطلاقاً — كوكي HttpOnly يضبطه الخادم تلقائياً
// (محصّن ضد سرقة XSS). نحفظ فقط بيانات العرض غير الحساسة (الاسم/الدور).
function clearAuth() {
  localStorage.removeItem('user')
  localStorage.removeItem('saved_username')
  sessionStorage.removeItem('user')
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  // إرسال/استقبال كوكي الجلسة مع كل طلب (نفس الموقع عبر Vite proxy، وعبر النطاق مع CORS صريح)
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
