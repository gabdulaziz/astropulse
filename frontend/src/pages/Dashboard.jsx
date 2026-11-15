import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertOctagon, ArrowDownRight, ArrowRight, ArrowUpRight, Clock, Minus, Phone, Radiation, ShieldCheck, Siren, Sparkles } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Card, Loader, Page, ScoreRing, Sparkline, StatusPill } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { useAuth } from '../lib/AuthContext'
import { Icon, STATUS_COLOR, formatValue, timeAgo } from '../lib/health'

const TREND = { up: ArrowUpRight, down: ArrowDownRight, steady: Minus }

export default function Dashboard() {
  const { assessment: a, active, routine, readOnly, isAdmin } = useCrew()
  const { me } = useAuth()
  const nav = useNavigate()
  const openedMyRecord = !isAdmin && !readOnly ? (me?.emergency_on_me || []).filter((g) => Date.now() - new Date(g.created_at) < 48 * 3600e3) : []
  if (!a || !active) return <Loader />

  const due = routine.filter((r) => r.due)
  const env = a.environment
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <Page>
      <TopBar title={readOnly || isAdmin ? active.name : `${greet}, ${active.name.split(' ')[0]}`} subtitle={`${active.mission_name || 'Mission'} · Day ${a.mission_day} · ${env.name}`} />

      {openedMyRecord.length > 0 && (
        <Card className="s-critical" style={{ marginBottom: 18, borderColor: 'rgba(251,113,133,.45)' }}>
          <div className="row" style={{ gap: 12 }}>
            <Siren size={22} color="#fb7185" />
            <div>
              <strong>Your record was opened with emergency access</strong>
              {openedMyRecord.map((g) => (
                <div key={g.id} className="muted">{g.requester} · {new Date(g.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · “{g.reason}”</div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid hero">
        <Card className="row wrap" style={{ gap: 26 }}>
          <ScoreRing score={a.score} status={a.overall} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <StatusPill status={a.overall} pulse={a.overall !== 'nominal'} />
            <h2 style={{ fontSize: 23, margin: '12px 0 8px' }}>{a.summary}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {a.indicators.filter((i) => i.status === 'nominal').length} of {a.indicators.length} indicators nominal ·{' '}
              {a.alerts.length} alert{a.alerts.length === 1 ? '' : 's'}
            </p>
            <div className="row wrap mt">
              {!readOnly && <button className="btn primary" onClick={() => nav('/check-in')}>
                <Sparkles size={17} /> Start check-in {due.length > 0 && `(${due.length} due)`}
              </button>}
              <button className="btn" onClick={() => nav('/body')}>View body map</button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="panel-title">Mission environment</div>
          <dl className="kv">
            <dt>Location</dt><dd>{env.name}</dd>
            <dt>Gravity</dt><dd>{env.gravity_g === 0 ? 'Microgravity' : `${env.gravity_g} g`}</dd>
            <dt>Comms delay</dt><dd>{env.comm_delay}</dd>
            <dt>Evacuation</dt><dd>{env.evacuation}</dd>
            <dt>Typical dose</dt><dd>~{env.typical_dose_msv_day} mSv / day</dd>
          </dl>
          <p className="faint" style={{ marginBottom: 0 }}>{env.notes}</p>
        </Card>

        <Card>
          <div className="panel-title"><Radiation size={18} color="#fbbf24" /> Radiation budget</div>
          <div className="stat">{a.radiation.career_msv} <span className="muted">/ {a.radiation.limit_msv} mSv</span></div>
          <div className="progress mt">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, a.radiation.career_pct)}%` }} transition={{ duration: 1.4, ease: 'easeOut' }}
              style={{ background: a.radiation.career_pct > 80 ? STATUS_COLOR.critical : a.radiation.career_pct > 50 ? STATUS_COLOR.caution : undefined }} />
          </div>
          <div className="row mt" style={{ justifyContent: 'space-between' }}>
            <span className="muted">This mission: <strong style={{ color: 'var(--text)' }}>{a.radiation.mission_msv} mSv</strong></span>
            <span className="muted">{a.radiation.career_pct}% of NASA limit</span>
          </div>
          <p className="faint" style={{ marginBottom: 0 }}>Measured against NASA's 600 mSv career limit. Other space agencies set their own limits.</p>
        </Card>
      </div>

      {a.alerts.length > 0 && (
        <Card className="mt-l">
          <div className="panel-title"><AlertOctagon size={18} color="#fb7185" /> Alerts & guidance <span className="muted">Act on these first</span></div>
          <div className="grid g-2">
            {a.alerts.map((al, i) => (
              <motion.div key={i} className={`alert s-${al.level}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}>
                <h4><span className="dot pulse" /> {al.title}</h4>
                <div className="muted" style={{ marginTop: 6 }}>{al.message}</div>
                {al.actions && <ul>{al.actions.map((x, j) => <li key={j}>{x}</li>)}</ul>}
                {al.escalate && <div className="escalate"><Phone size={13} /> Contact flight surgeon</div>}
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      <div className="row mt-l" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 19 }}>Health indicators</h3>
        <span className="faint">Tap a card to see its trend</span>
      </div>
      <div className="grid g-3 mt">
        {a.indicators.map((ind) => {
          const T = TREND[ind.trend]
          return (
            <Card key={ind.key} hover className={`ind-card s-${ind.status}`} pad={false} onClick={() => nav(`/trends?i=${ind.key}`)}>
              <div className="ind-top">
                <div className="ind-icon"><Icon name={ind.icon} size={18} /></div>
                {ind.name}
                <span style={{ marginLeft: 'auto' }}><StatusPill status={ind.status} /></span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div className="ind-value">
                  {formatValue(ind)}
                  {ind.value != null && ind.key !== 'mood' && <small>{ind.unit}</small>}
                  {ind.change_pct != null && <small>({ind.change_pct > 0 ? '+' : ''}{ind.change_pct}%)</small>}
                </div>
                <Sparkline data={ind.spark} color={STATUS_COLOR[ind.status]} />
              </div>
              <div className="ind-foot">
                <span className="row" style={{ gap: 4 }}><T size={14} /> {ind.trend}</span>
                <span className="row" style={{ gap: 6, color: ind.overdue ? 'var(--caution)' : undefined }}>
                  <Clock size={12} /> {ind.overdue ? 'Due · ' : ''}{timeAgo(ind.recorded_at)}
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid g-2 mt-l">
        <Card>
          <div className="panel-title"><Clock size={18} color="#22d3ee" /> Measurement routine</div>
          <div className="grid" style={{ gap: 8 }}>
            {routine.slice(0, 6).map((r) => (
              <div key={r.indicator} className="due-item">
                <Icon name={r.icon} size={17} color="#a5abd6" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                  <div className="faint">Every {r.every_hours >= 168 ? `${r.every_hours / 168} week` : r.every_hours >= 48 ? `${r.every_hours / 24} days` : 'day'}</div>
                </div>
                <span className="when" style={{ color: r.due ? 'var(--caution)' : 'var(--nominal)' }}>
                  {r.due ? 'Due now' : `in ${r.due_in_hours < 1 ? '<1' : Math.round(r.due_in_hours)} h`}
                </span>
              </div>
            ))}
          </div>
          <button className="btn sm mt" onClick={() => nav('/check-in')}>Go to check-in <ArrowRight size={14} /></button>
        </Card>
        <Card>
          <div className="panel-title"><ShieldCheck size={18} color="#34d399" /> Today's countermeasures</div>
          <ul className="list">
            <li><ShieldCheck size={16} color="#34d399" /> About 2 hours of exercise: resistance for bone and muscle, cardio for the heart.</li>
            <li><ShieldCheck size={16} color="#34d399" /> Drink 2–2.5 L of water to protect your kidneys from stones.</li>
            <li><ShieldCheck size={16} color="#34d399" /> Keep a fixed 8-hour sleep window with warm light before bed.</li>
            <li><ShieldCheck size={16} color="#34d399" /> Take 10 minutes for yourself: window time, music, a call home.</li>
            {env.comm_delay_s > 300 && <li><AlertOctagon size={16} color="#fbbf24" /> With a {env.comm_delay} delay, you are first responder: act, then report.</li>}
          </ul>
          <button className="btn sm mt" onClick={() => nav('/quests')}>Open quests <ArrowRight size={14} /></button>
        </Card>
      </div>
      <p className="disclaimer">AstroPulse is a hackathon prototype for education. Thresholds follow common clinical reference ranges and are not medical advice.</p>
    </Page>
  )
}
