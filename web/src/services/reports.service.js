import api from './api'

export const reportsApi = {
  getDashboard: (params) => api.get('/reports/dashboard', { params }),
  getTechnicians: () => api.get('/reports/technicians'),
}
