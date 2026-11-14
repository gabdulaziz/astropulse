import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'

// Who is logged in, and whether an astronaut is currently using emergency access.
// The login pass is kept in this browser (localStorage) and renewed on every visit,
// so astronauts stay signed in until they press "Log out" (or 30 days without opening the app).
const AuthContext = createContext(null)
const VIEWING_KEY = 'astropulse.emergency'

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [checking, setChecking] = useState(() => !!getToken())
  const [viewing, setViewing] = useState(null) // the emergency access being used, if any

  const logout = useCallback(() => {
    setToken(null)
    try { sessionStorage.removeItem(VIEWING_KEY); localStorage.removeItem('astropulse.active') } catch { /* ignore */ }
    setMe(null)
    setViewing(null)
  }, [])

  useEffect(() => { setUnauthorizedHandler(logout) }, [logout])

  const loadMe = useCallback(async () => {
    try {
      const d = await api.me()
      setToken(d.token) // fresh 30-day (or 12-hour) pass
      setMe(d)
      // restore an emergency view after a page reload, if it is still active
      let wanted = null
      try { wanted = Number(sessionStorage.getItem(VIEWING_KEY)) || null } catch { /* ignore */ }
      const held = (d.emergency_held || []).find((g) => g.id === wanted)
      setViewing(held || null)
      return d
    } catch {
      return null // a 401 already logged us out; a network error keeps the current state
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { if (getToken()) loadMe() }, []) // eslint-disable-line

  // renew the pass when the user comes back to the tab
  useEffect(() => {
    const onFocus = () => { if (getToken()) loadMe() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadMe])

  async function loginAstronaut(id, pin) {
    const d = await api.loginAstronaut(id, pin)
    setToken(d.token)
    await loadMe()
  }
  async function loginAdmin(username, password) {
    const d = await api.loginAdmin(username, password)
    setToken(d.token)
    await loadMe()
  }

  async function startEmergency(astronautId, reason) {
    const g = await api.startEmergency(astronautId, reason)
    try { sessionStorage.setItem(VIEWING_KEY, g.id) } catch { /* ignore */ }
    setViewing(g)
    return g
  }
  const endEmergency = useCallback(async () => {
    const g = viewing
    try { sessionStorage.removeItem(VIEWING_KEY) } catch { /* ignore */ }
    setViewing(null)
    if (g) await api.endEmergency(g.id).catch(() => {})
  }, [viewing])

  return (
    <AuthContext.Provider value={{
      me, checking, viewing, isAdmin: me?.role === 'admin',
      loginAstronaut, loginAdmin, logout, loadMe, startEmergency, endEmergency,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
