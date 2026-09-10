import api from './api'

export const trackingApi = {
  getLive: () => api.get('/tracking/live'),
  getPath: (userId, from, to) => api.get(`/tracking/path/${userId}`, { params: { from, to } }),
  getSignalReadings: (params) => api.get('/tracking/signal', { params }),
  // حالة تتبع المستخدم الحالي (can_track + سبب المنع بدقة)
  getStatus: () => api.get('/tracking/status'),
  // تسجيل موقع (يُستخدم من صفحة التتبع — الأخطاء تُعاد للمستدعي لعرضها)
  logLocation: (payload) => api.post('/tracking/log', payload),
}
