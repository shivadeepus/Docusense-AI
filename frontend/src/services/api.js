import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Auth token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
}

// ── Workspaces ────────────────────────────────────────────────
export const workspaceApi = {
  list: () => api.get('/workspaces'),
  create: (data) => api.post('/workspaces', data),
  get: (id) => api.get(`/workspaces/${id}`),
  delete: (id) => api.delete(`/workspaces/${id}`),
}

// ── Documents ─────────────────────────────────────────────────
export const documentApi = {
  list: (workspaceId) => api.get(`/documents/${workspaceId}`),
  upload: (workspaceId, file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/documents/upload/${workspaceId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
      }
    })
  },
  delete: (docId) => api.delete(`/documents/${docId}`),
}

// ── Chat ──────────────────────────────────────────────────────
export const chatApi = {
  createSession: (data) => api.post('/chat/sessions', data),
  listSessions: (workspaceId) => api.get(`/chat/sessions/${workspaceId}`),
  deleteSession: (id) => api.delete(`/chat/sessions/${id}`),
  getMessages: (sessionId) => api.get(`/chat/messages/${sessionId}`),
  ask: (data) => api.post('/chat/ask', data),
}

// ── Analytics ─────────────────────────────────────────────────
export const analyticsApi = {
  workspace: (id) => api.get(`/analytics/workspace/${id}`),
  system: () => api.get('/analytics/system'),
}

export default api
