import api from './api'

export const networksApi = {
  // band / status / page / limit
  getAll: (params = {}) => api.get('/networks', { params }),
  getById: (id) => api.get(`/networks/${id}`),
  create: (data) => api.post('/networks', data),
  update: (id, data) => api.put(`/networks/${id}`, data),
  remove: (id) => api.delete(`/networks/${id}`),
}
