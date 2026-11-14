import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon, Clock, KeyRound, Lock, RefreshCw, Siren } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Card, Loader, Page, StatusPill } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { api } from '../lib/api'
import { STATUS_COLOR, timeAgo } from '../lib/health'
import Avatar from '../components/Avatar'

// Mission Control only: every astronaut at a glance, plus the emergency access log.
export default function Overview() {
  const { setActiveId } = useCrew()
  const nav = useNavigate()
  const [crew, setCrew] = useState(null)
  const [log, setLog] = useState([])
  const load = () => Promise.all([api.overview(), api.accessLog()]).then(([c, l]) => { setCrew(c); setLog(l) })
  useEffect(() => { load() }, [])
  if (!crew) return <Loader />

  const counts = crew.reduce((acc, a) => ({ ...acc, [a.overall]: (acc[a.overall] || 0) + 1 }), {})
  const open = (id) => { setActiveId(id); nav('/') }

  return (
    <Page>
      <TopBar title="Crew Overview" subtitle="Every astronaut's health at a glance">
        <button className="btn sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </TopBar>

      <div className="grid g-3">
        {['critical', 'caution', 'nominal'].map((s) => (
          <Card key={s} className={`s-${s}`}>
            <div className="faint" style={{ textTransform: 'capitalize' }}>{s}</div>
            <div className="row"><span className="dot pulse" style={{ width: 12, height: 12 }} /><div className="stat" style={{ fontSize: 40 }}>{counts[s] || 0}</div><span className="muted">astronaut{(counts[s] || 0) === 1 ? '' : 's'}</span></div>
          </Card>
        ))}
      </div>

      <div className="grid g-3 mt-l">
        {crew.map((a, i) => (
          <Card key={a.id} hover className={`s-${a.overall}`} style={{ cursor: 'pointer', borderColor: a.overall !== 'nominal' ? STATUS_COLOR[a.overall] + '88' : undefined }} onClick={() => open(a.id)}>
            <div className="row">
              <Avatar person={a} size={50} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 17 }}>{a.name}</h3>
                <div className="faint">{a.role} · {a.environment}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <motion.div className="stat" style={{ color: STATUS_COLOR[a.overall] }} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 + i * 0.06 }}>{a.score}</motion.div>
                <div className="faint">score</div>
              </div>
            </div>
            <div className="row mt" style={{ gap: 8, flexWrap: 'wrap' }}>
              <StatusPill status={a.overall} pulse={a.overall === 'critical'} />
              <span className="chip" style={{ padding: '3px 10px', fontSize: 12 }}><Clock size={12} /> {a.last_checkin ? timeAgo(a.last_checkin) : 'never'}</span>
              <span className="chip" style={{ padding: '3px 10px', fontSize: 12 }}>Day {a.mission_day}</span>
              {!a.has_pin && <span className="pill s-caution"><KeyRound size={11} /> No PIN</span>}
              {a.locked && <span className="pill s-critical"><Lock size={11} /> Locked</span>}
            </div>
            <ul className="list mt" style={{ gap: 6 }}>
              {a.alerts.slice(0, 3).map((al, j) => (
                <li key={j} style={{ fontSize: 13 }}><AlertOctagon size={14} color={STATUS_COLOR[al.level]} />{al.title}</li>
              ))}
              {!a.alerts.length && <li style={{ fontSize: 13 }}>No alerts</li>}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-l">
        <div className="panel-title"><Siren size={18} color="#fb7185" /> Emergency access log <span className="muted">{log.length} record{log.length === 1 ? '' : 's'}</span></div>
        {!log.length ? <div className="empty">No emergency access has been used.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>When</th><th>Opened by</th><th>Record of</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {log.map((g) => (
                  <tr key={g.id}>
                    <td>{new Date(g.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>{g.requester}</strong></td>
                    <td>{g.astronaut}</td>
                    <td className="muted">{g.reason}</td>
                    <td>{g.active ? <span className="pill s-critical"><span className="dot pulse" /> Active</span> : <span className="pill s-unknown">Ended</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  )
}
