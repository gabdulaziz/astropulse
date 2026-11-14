import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trash2 } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Card, Loader, Page, StatusPill, Tabs, useToast } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { api } from '../lib/api'
import { Icon, MOODS, STATUS_COLOR } from '../lib/health'

function ChartTip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="glass" style={{ padding: '10px 14px', fontSize: 13 }}>
      <div className="faint">{new Date(p.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{p.v}{p.v2 != null && `/${p.v2}`} <span className="faint">{unit}</span></div>
      <StatusPill status={p.status} />
    </div>
  )
}

export default function Trends() {
  const { indicators, active, refresh, readOnly } = useCrew()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const key = params.get('i') || 'heart_rate'
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState(null)
  const spec = indicators.find((i) => i.key === key)

  const load = () => api.readings(active.id, { indicator: key, days }).then(setRows)
  useEffect(() => { if (active) { setRows(null); load() } }, [key, days, active?.id]) // eslint-disable-line

  const data = useMemo(() => (rows || []).slice().reverse().map((r) => ({
    t: r.recorded_at, v: r.value, v2: r.value2, status: r.status,
    label: new Date(r.recorded_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
  })), [rows])

  if (!spec || !active) return <Loader />
  const vals = data.map((d) => d.v)
  const stats = vals.length ? {
    latest: vals.at(-1), avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
    min: Math.min(...vals), max: Math.max(...vals),
  } : null
  const counts = data.reduce((acc, d) => ({ ...acc, [d.status]: (acc[d.status] || 0) + 1 }), {})

  // Nominal band (for body mass the band is relative to baseline)
  const base = active.baseline_mass_kg || data[0]?.v
  const band = spec.relative && base ? [base * (1 + spec.nominal[0] / 100), base * (1 + spec.nominal[1] / 100)] : spec.nominal
  const color = '#7c5cff'

  return (
    <Page>
      <TopBar title="Trends" subtitle="How your health indicators change over the mission">
        <Tabs id="days" value={days} onChange={setDays} tabs={[7, 14, 30, 90].map((d) => ({ value: d, label: `${d}d` }))} />
      </TopBar>

      <div className="row wrap" style={{ gap: 8 }}>
        {indicators.map((i) => (
          <motion.button key={i.key} whileTap={{ scale: 0.95 }} className={`btn sm ${i.key === key ? 'primary' : ''}`} onClick={() => setParams({ i: i.key })}>
            <Icon name={i.icon} size={14} /> {i.short}
          </motion.button>
        ))}
      </div>

      <Card className="mt">
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 22 }}>{spec.name}</h2>
            <div className="faint">Green band = nominal range · {data.length} readings in {days} days</div>
          </div>
          {stats && (
            <div className="row wrap" style={{ gap: 26 }}>
              {[['Latest', stats.latest], ['Average', stats.avg], ['Min', stats.min], ['Max', stats.max]].map(([l, v]) => (
                <div key={l}><div className="faint">{l}</div><div className="stat" style={{ fontSize: 22 }}>{key === 'mood' ? v : v}<span className="faint"> {key !== 'mood' && spec.unit}</span></div></div>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={key + days} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: 360, marginTop: 20 }}>
            {!rows ? <Loader text="Downloading telemetry…" /> : !data.length ? <div className="empty">No readings in this period. Log one in Health Check-in.</div> : (
              <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.45} /><stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,255,.08)" vertical={false} />
                  <XAxis dataKey="label" stroke="#6f76a8" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis stroke="#6f76a8" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <ReferenceArea ifOverflow="hidden" y1={band[0]} y2={band[1]} fill="#34d399" fillOpacity={0.08} stroke="#34d399" strokeOpacity={0.25} strokeDasharray="4 4" />
                  {key === 'blood_pressure' && <ReferenceArea ifOverflow="hidden" y1={spec.nominal2[0]} y2={spec.nominal2[1]} fill="#22d3ee" fillOpacity={0.06} />}
                  {!spec.relative && spec.caution[1] < 1000 && key !== 'spo2' && key !== 'mood' && <ReferenceLine y={spec.caution[1]} stroke="#fb7185" strokeDasharray="6 6" strokeOpacity={0.6} />}
                  <Tooltip content={<ChartTip unit={spec.unit} />} cursor={{ stroke: 'rgba(255,255,255,.2)' }} />
                  <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} fill="url(#area)" animationDuration={1200}
                    dot={(p) => <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill={STATUS_COLOR[p.payload.status]} stroke="#0a0d24" strokeWidth={1.5} />}
                    activeDot={{ r: 6, fill: '#fff' }} />
                  {key === 'blood_pressure' && <Line type="monotone" dataKey="v2" stroke="#22d3ee" strokeWidth={2.5} dot={false} />}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="row wrap mt" style={{ gap: 16 }}>
          {['nominal', 'caution', 'critical'].map((s) => <span key={s} className={`row s-${s}`} style={{ gap: 6, fontSize: 13, color: 'var(--text-dim)' }}><span className="dot" />{counts[s] || 0} {s}</span>)}
          {key === 'blood_pressure' && <span className="faint">Purple = systolic · Cyan = diastolic</span>}
        </div>
      </Card>

      <div className="grid g-2 mt-l">
        <Card>
          <div className="panel-title">Why it changes in space</div>
          <p className="muted" style={{ marginTop: 0 }}>{spec.in_space}</p>
          <div className="panel-title mt" style={{ fontSize: 14 }}>If it leaves the green band</div>
          <ul className="list">{spec.actions.caution.map((a, i) => <li key={i}><span className="dot s-caution" style={{ marginTop: 7 }} />{a}</li>)}</ul>
        </Card>
        <Card>
          <div className="panel-title">Recent readings</div>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            <table className="table">
              <thead><tr><th>When</th><th>Value</th><th>Status</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {(rows || []).slice(0, 40).map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.recorded_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>{key === 'mood' ? MOODS[r.value - 1]?.e : r.value}{r.value2 != null && `/${r.value2}`}</strong></td>
                    <td><StatusPill status={r.status} /></td>
                    <td className="faint">{r.notes}</td>
                    <td>{!readOnly && <button className="btn ghost sm" style={{ padding: 4 }} title="Delete" onClick={async () => {
                      try { await api.deleteReading(r.id); load(); refresh() } catch (e) { toast(e.message, 'warn') }
                    }}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Page>
  )
}
