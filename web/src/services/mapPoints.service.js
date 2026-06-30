import api from './api'

export const mapPointsApi = {
  getAll: (params) => api.get('/map-points', { params }),
  getMyRequests: () => api.get('/map-points/my-requests'),
  create: (data) => api.post('/map-points', data),
  review: (id, status) => api.post(`/map-points/${id}/review`, { status }),
  delete: (id) => api.delete(`/map-points/${id}`),
}
