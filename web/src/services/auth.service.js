import api from './api'

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  changePassword: (current_password, new_password) =>
    api.put('/auth/password', { current_password, new_password }),
  updateProfile: (data) =>
    api.put('/auth/profile', data),
}