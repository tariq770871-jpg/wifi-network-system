import api from './api'

export const usersApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  controlTracking: (id, enabled) => api.post(`/users/${id}/tracking`, { enabled }),
  vetoTracking: (veto) => api.post('/users/me/veto', { veto }),
}
