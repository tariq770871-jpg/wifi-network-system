import api from './api'

export const ticketsApi = {
  getAll: (params) => api.get('/tickets', { params }),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  assign: (id, technicianId) => api.post(`/tickets/${id}/assign`, { assigned_to: technicianId }),
  start: (id) => api.post(`/tickets/${id}/start`),
  claim: (id) => api.post(`/tickets/${id}/claim`),
  complete: (id, notes) => api.post(`/tickets/${id}/complete`, { notes }),
  delete: (id) => api.delete(`/tickets/${id}`),
  // MULTI-NETWORK: ربط/إزالة البلاغ من شبكة — للأدمن والدعم (أداة «ربط البلاغات القديمة»)
  // siteId = null لإزالة الربط
  setSite: (id, siteId) => api.post(`/tickets/${id}/site`, { site_id: siteId }),
}
