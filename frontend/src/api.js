const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '')

export function getToken() {
  return localStorage.getItem('expense_token')
}

export function setSession(token, user) {
  localStorage.setItem('expense_token', token)
  localStorage.setItem('expense_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('expense_token')
  localStorage.removeItem('expense_user')
}

export function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('expense_user') || 'null') }
  catch { return null }
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach the API. Check that Flask is running and VITE_API_URL is correct.')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = body.error || body.message || `Request failed (${response.status})`
    const requestError = new Error(message)
    requestError.status = response.status
    throw requestError
  }
  return body
}
