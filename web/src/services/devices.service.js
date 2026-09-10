import api from './api'

/** خدمة الأجهزة — مرتبطة بمسارات /api/devices */
export const devicesApi = {
  list: (params = {}) => api.get('/devices', { params }),
  get: (id) => api.get(`/devices/${id}`),
  create: (payload) => api.post('/devices', payload),
  update: (id, payload) => api.put(`/devices/${id}`, payload),
  delete: (id) => api.delete(`/devices/${id}`),
  // اختبار اتصال MikroTik الحي (يحدّث الحالة وآخر ظهور)
  testConnection: (id) => api.post(`/devices/${id}/test`),
  // قراءة الموارد الحية (CPU/ذاكرة/SSID)
  status: (id) => api.get(`/devices/${id}/status`),
}
