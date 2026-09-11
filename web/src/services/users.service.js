import api from './api'

export const usersApi = {
  // search: بحث نصي في الخادم (username/full_name/phone) — يعمل عبر كل الصفحات
  getAll: (params = {}) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  // إنشاء مستخدم بأي دور — المدير فقط (يستبدل auth/register المفتوح سابقاً)
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, newPassword) => api.put(`/users/${id}/password`, { new_password: newPassword }),
  controlTracking: (id, enabled) => api.post(`/users/${id}/tracking`, { enabled }),
  vetoTracking: (veto) => api.post('/users/me/veto', { veto }),
}
