import createClient from 'openapi-fetch'
import type { paths } from './schema'

const TOKEN_KEY = 'overlap.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_URL })

api.use({
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ response }) {
    // A 401 means the token expired or was revoked. A full page load to
    // sign-in also drops every cached query, so no stale data leaks across users.
    if (response.status === 401 && location.pathname !== '/sign-in') {
      clearToken()
      location.assign('/sign-in')
    }
    return response
  },
})
