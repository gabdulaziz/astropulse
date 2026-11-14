import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './AuthContext'

// Holds whose record is on screen and the shared data for it (assessment, progress, routine).
//  - Mission Control: can switch between every astronaut.
//  - Astronaut: always their own record, or the crewmate they opened with emergency access.
const CrewContext = createContext(null)

export function CrewProvider({ children }) {
  const { me, viewing, isAdmin } = useAuth()
  const [crew, setCrew] = useState([])
  const [viewed, setViewed] = useState(null) // profile opened through emergency access
  const [adminActive, setAdminActive] = useState(() => Number(localStorage.getItem('astropulse.active')) || null)
  const [assessment, setAssessment] = useState(null)
  const [progress, setProgress] = useState(null)
  const [routine, setRoutine] = useState([])
  const [indicators, setIndicators] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const activeId = !me ? null : isAdmin ? adminActive : viewing ? viewing.astronaut_id : me.id
  const setActiveId = useCallback((id) => { if (isAdmin) setAdminActive(id) }, [isAdmin])
  const readOnly = !!viewing // emergency access never changes someone else's record

  const loadCrew = useCallback(async () => {
    if (!me) return
    try {
      const [list, inds] = await Promise.all([api.astronauts(), api.indicators()])
      setCrew(list)
      setIndicators(inds)
      setError(null)
      if (isAdmin) {
        if (list.length && !list.some((a) => a.id === adminActive)) setAdminActive(list[0].id)
        if (!list.length) {
          setAdminActive(null)
          localStorage.removeItem('astropulse.active')
          setAssessment(null); setProgress(null); setRoutine([])
          setLoading(false)
        }
      }
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }, [me, isAdmin, adminActive])

  // the crewmate's profile, when using emergency access
  useEffect(() => {
    if (!viewing) { setViewed(null); return }
    api.astronaut(viewing.astronaut_id).then(setViewed).catch(() => setViewed(null))
  }, [viewing])

  const known = viewing ? viewed?.id === activeId : crew.some((a) => a.id === activeId)

  const refresh = useCallback(async () => {
    // only ask the server about an astronaut that really exists and that we may see
    if (!activeId || !known) return
    try {
      const [a, p, r] = await Promise.all([api.assessment(activeId), api.progress(activeId), api.routine(activeId)])
      setAssessment(a)
      setProgress(p)
      setRoutine(r)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeId, known])

  useEffect(() => { loadCrew() }, [me]) // eslint-disable-line
  // switching to another astronaut: clear the old one's data first, so it never shows under the wrong name
  useEffect(() => { setAssessment(null); setProgress(null); setRoutine([]) }, [activeId])
  useEffect(() => {
    if (isAdmin && adminActive) localStorage.setItem('astropulse.active', adminActive)
    refresh()
  }, [activeId, refresh, isAdmin, adminActive])

  const active = viewing ? viewed : crew.find((a) => a.id === activeId) || null

  return (
    <CrewContext.Provider value={{
      crew, active, activeId, setActiveId, assessment, progress, setProgress, routine, indicators,
      refresh, loadCrew, loading, error, readOnly, isAdmin,
    }}>
      {children}
    </CrewContext.Provider>
  )
}

export const useCrew = () => useContext(CrewContext)
