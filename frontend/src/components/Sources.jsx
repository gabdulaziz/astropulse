import { createContext, useContext, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { api } from '../lib/api'

// Loads the list of sources once and shows small "source" links next to facts.
const SourcesCtx = createContext({})

export function SourcesProvider({ children }) {
  const [byId, setById] = useState({})
  useEffect(() => {
    api.sources().then((list) => setById(Object.fromEntries(list.map((s) => [s.id, s])))).catch(() => {})
  }, [])
  return <SourcesCtx.Provider value={byId}>{children}</SourcesCtx.Provider>
}
export const useSources = () => useContext(SourcesCtx)

// Short label for a source chip: who published it
function short(s) {
  if (s.id.startsWith('nasa_')) return s.challenge ? 'NASA HRP' : 'NASA'
  if (s.id.startsWith('csa_')) return 'CSA'
  if (s.id === 'clinical') return 'Clinical ranges'
  return s.title.match(/\(([^)]+)\)/)?.[1] || s.publisher
}

export function SourceLinks({ ids = [], label = 'Sources' }) {
  const byId = useSources()
  const list = ids.map((id) => byId[id]).filter(Boolean)
  if (!list.length) return null
  return (
    <div className="source-row">
      <span className="faint">{label}:</span>
      {list.map((s) => s.url ? (
        <a key={s.id} className={`source-chip ${s.challenge ? 'official' : ''}`} href={s.url} target="_blank" rel="noreferrer" title={`${s.title}: ${s.used_for}`}>
          {short(s)} <ExternalLink size={10} />
        </a>
      ) : (
        <span key={s.id} className="source-chip" title={s.used_for}>{short(s)}</span>
      ))}
    </div>
  )
}
