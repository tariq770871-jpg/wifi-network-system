import api from './api'

export const ticketsApi = {
  getAll: (params) => api.get('/tickets', { params }),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  assign: (id, technicianId) => api.post(`/tickets/${id}/assign`, { technician_id: technicianId }),
  start: (id) => api.post(`/tickets/${id}/start`),
  complete: (id, notes) => api.post(`/tickets/${id}/complete`, { notes }),
  delete: (id) => api.delete(`/tickets/${id}`),
}
