import api from './api'

// FEATURE: الشبكات/المواقع — خدمات الواجهة للشبكات (مجموعات العمل)
export const sitesApi = {
  getAll: (params) => api.get('/sites', { params }),
  getById: (id) => api.get(`/sites/${id}`),
  create: (data) => api.post('/sites', data),
  update: (id, data) => api.put(`/sites/${id}`, data),
  delete: (id) => api.delete(`/sites/${id}`),
}
