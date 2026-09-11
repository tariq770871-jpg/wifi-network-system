import api from './api'

export const subscriptionsApi = {
  // status / plan / search / expiring_days / page / limit
  getAll: (params = {}) => api.get('/subscriptions', { params }),
  getById: (id) => api.get(`/subscriptions/${id}`),
  create: (data) => api.post('/subscriptions', data),
  update: (id, data) => api.put(`/subscriptions/${id}`, data),
  renew: (id, months = 1) => api.post(`/subscriptions/${id}/renew`, { months }),
  remove: (id) => api.delete(`/subscriptions/${id}`),
}
