import api from './api'

export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getTechnicians: () => api.get('/reports/technicians'),
}
