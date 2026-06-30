import api from './api'

export const trackingApi = {
  getLive: () => api.get('/tracking/live'),
  getPath: (userId, from, to) => api.get(`/tracking/path/${userId}`, { params: { from, to } }),
  getSignalReadings: (params) => api.get('/tracking/signal', { params }),
}
