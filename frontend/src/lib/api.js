// API client for the FastAPI backend. Sends the login pass (token) with every request.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'astropulse.token'
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

// The AuthProvider registers what to do when the server says "please log in" (401).
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(path, options = {}, { auth = true } = {}) {
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized()
    const detail = data?.detail
    const msg = Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : detail || res.statusText
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  // login
  roster: () => request('/api/auth/roster', {}, { auth: false }),
  loginAstronaut: (astronautId, pin) => request('/api/auth/astronaut', { method: 'POST', body: { astronaut_id: astronautId, pin } }, { auth: false }),
  loginAdmin: (username, password) => request('/api/auth/admin', { method: 'POST', body: { username, password } }, { auth: false }),
  me: () => request('/api/auth/me'),
  changePin: (current_pin, new_pin) => request('/api/auth/change-pin', { method: 'POST', body: { current_pin, new_pin } }),
  logoutEverywhere: () => request('/api/auth/logout-everywhere', { method: 'POST' }),
  // emergency
  startEmergency: (astronautId, reason) => request('/api/emergency', { method: 'POST', body: { astronaut_id: astronautId, reason } }),
  endEmergency: (id) => request(`/api/emergency/${id}/end`, { method: 'POST' }),
  // Mission Control
  overview: () => request('/api/admin/overview'),
  accessLog: () => request('/api/admin/access-log'),
  setPin: (id, pin) => request(`/api/astronauts/${id}/pin`, { method: 'POST', body: { pin } }),
  // profile photos
  uploadPhoto: (id, blob) => { const f = new FormData(); f.append('file', blob, 'photo.jpg'); return request(`/api/astronauts/${id}/photo`, { method: 'POST', body: f }) },
  deletePhoto: (id) => request(`/api/astronauts/${id}/photo`, { method: 'DELETE' }),
  uploadAdminPhoto: (blob) => { const f = new FormData(); f.append('file', blob, 'photo.jpg'); return request('/api/admin/me/photo', { method: 'POST', body: f }) },
  deleteAdminPhoto: () => request('/api/admin/me/photo', { method: 'DELETE' }),
  // crew
  astronauts: () => request('/api/astronauts'),
  astronaut: (id) => request(`/api/astronauts/${id}`),
  createAstronaut: (body) => request('/api/astronauts', { method: 'POST', body }),
  updateAstronaut: (id, body) => request(`/api/astronauts/${id}`, { method: 'PATCH', body }),
  deleteAstronaut: (id) => request(`/api/astronauts/${id}`, { method: 'DELETE' }),
  // vitals
  readings: (astronautId, { indicator, days = 30 } = {}) =>
    request(`/api/vitals?astronaut_id=${astronautId}&days=${days}${indicator ? `&indicator=${indicator}` : ''}`),
  addReadings: (astronautId, readings) => request('/api/vitals/batch', { method: 'POST', body: { astronaut_id: astronautId, readings } }),
  deleteReading: (id) => request(`/api/vitals/${id}`, { method: 'DELETE' }),
  // health
  assessment: (id) => request(`/api/assessment/${id}`),
  routine: (id) => request(`/api/routine/${id}`),
  progress: (id) => request(`/api/progress/${id}`),
  toggleTask: (astronautId, taskKey) => request('/api/tasks/toggle', { method: 'POST', body: { astronaut_id: astronautId, task_key: taskKey } }),
  // knowledge (public)
  indicators: () => request('/api/knowledge/indicators', {}, { auth: false }),
  hazards: () => request('/api/knowledge/hazards', {}, { auth: false }),
  bodySystems: () => request('/api/knowledge/body-systems', {}, { auth: false }),
  environments: () => request('/api/knowledge/environments', {}, { auth: false }),
  // images (files are private: fetched with the login pass, shown as a local blob)
  images: (astronautId) => request(`/api/images?astronaut_id=${astronautId}`),
  uploadImage: (form) => request('/api/images', { method: 'POST', body: form }),
  deleteImage: (id) => request(`/api/images/${id}`, { method: 'DELETE' }),
  imageBlobUrl: async (path) => {
    const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!res.ok) throw new Error('Image not available')
    return URL.createObjectURL(await res.blob())
  },
}
