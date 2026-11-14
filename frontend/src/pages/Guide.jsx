import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Globe2, ShieldCheck, Zap } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Card, Loader, Page, Tabs } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { api } from '../lib/api'
import { Icon } from '../lib/health'

export default function Guide() {
  const [tab, setTab] = useState('indicators')
  return (
    <Page>
      <TopBar title="Health Guide" subtitle="What to measure, why, and how space changes your body">
        <Tabs id="guide" value={tab} onChange={setTab} tabs={[
          { value: 'indicators', label: 'Indicators' }, { value: 'hazards', label: 'Five hazards' }, { value: 'env', label: 'Environments' },
        ]} />
      </TopBar>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
          {tab === 'indicators' && <Indicators />}
          {tab === 'hazards' && <Hazards />}
          {tab === 'env' && <Environments />}
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}

function range(s) {
  if (s.relative) return `Nominal ${s.nominal[0]}% to +${s.nominal[1]}% vs baseline · Caution ${s.caution[0]}% to +${s.caution[1]}%`
  if (s.key === 'blood_pressure') return `Nominal ${s.nominal[0]}–${s.nominal[1]} / ${s.nominal2[0]}–${s.nominal2[1]} · Caution up to ${s.caution[1]} / ${s.caution2[1]} mmHg`
  return `Nominal ${s.nominal[0]}–${s.nominal[1]} · Caution ${s.caution[0]}–${s.caution[1]} ${s.unit}`
}

function Indicators() {
  const { indicators } = useCrew()
  const [open, setOpen] = useState('heart_rate')
  return (
    <div className="grid" style={{ gap: 12 }}>
      {indicators.map((s) => (
        <motion.div key={s.key} layout className="glass" style={{ overflow: 'hidden' }}>
          <div className="accordion-head" onClick={() => setOpen(open === s.key ? null : s.key)}>
            <div className="ind-icon" style={{ background: 'rgba(124,92,255,.15)', color: '#b9a8ff' }}><Icon name={s.icon} size={18} /></div>
            <div><div style={{ fontWeight: 600 }}>{s.name}</div><div className="faint">{range(s)}</div></div>
            <motion.div style={{ marginLeft: 'auto' }} animate={{ rotate: open === s.key ? 180 : 0 }}><ChevronDown size={18} /></motion.div>
          </div>
          <AnimatePresence>
            {open === s.key && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                <div className="grid g-2" style={{ padding: '0 18px 18px' }}>
                  <div>
                    <div className="panel-title" style={{ fontSize: 14 }}>Why it matters</div>
                    <p className="muted" style={{ marginTop: -6 }}>{s.why}</p>
                    <div className="panel-title" style={{ fontSize: 14 }}>How to measure</div>
                    <ol className="how">{s.how_to.map((h, i) => <li key={i}>{h}</li>)}</ol>
                  </div>
                  <div>
                    <div className="panel-title" style={{ fontSize: 14 }}><Zap size={15} color="#fbbf24" /> In space</div>
                    <p className="muted" style={{ marginTop: -6 }}>{s.in_space}</p>
                    {['caution', 'critical'].map((lvl) => (
                      <div key={lvl} className={`alert s-${lvl}`} style={{ marginTop: 10 }}>
                        <h4>{lvl === 'caution' ? 'If amber' : 'If red'}</h4>
                        <ul>{s.actions[lvl].map((a, i) => <li key={i}>{a}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  )
}

function Hazards() {
  const [hazards, setHazards] = useState(null)
  const { indicators } = useCrew()
  useEffect(() => { api.hazards().then(setHazards) }, [])
  if (!hazards) return <Loader />
  return (
    <>
      <Card>
        <h2 style={{ fontSize: 22 }}>The <span className="gradient-text">RIDGE</span> of spaceflight</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          NASA's Human Research Program groups the dangers of spaceflight into five hazards: Radiation, Isolation and confinement,
          Distance from Earth, Gravity fields, and hostile/closed Environments. Every indicator in AstroPulse watches for one or more of them.
        </p>
      </Card>
      <div className="grid g-2 mt">
        {hazards.map((h, i) => (
          <Card key={h.key} hover>
            <div className="row" style={{ gap: 14 }}>
              <motion.div className="hazard-letter" initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}>{h.letter}</motion.div>
              <div><h3 style={{ fontSize: 18 }}>{h.name}</h3><div className="faint">{h.summary}</div></div>
            </div>
            <div className="grid g-2 mt" style={{ gap: 14 }}>
              <div>
                <div className="panel-title" style={{ fontSize: 13, marginBottom: 8 }}><Zap size={14} color="#fbbf24" /> Effects</div>
                <ul className="list">{h.effects.map((e, j) => <li key={j} style={{ fontSize: 13 }}><span className="dot s-caution" style={{ marginTop: 7 }} />{e}</li>)}</ul>
              </div>
              <div>
                <div className="panel-title" style={{ fontSize: 13, marginBottom: 8 }}><ShieldCheck size={14} color="#34d399" /> Countermeasures</div>
                <ul className="list">{h.countermeasures.map((e, j) => <li key={j} style={{ fontSize: 13 }}><span className="dot s-nominal" style={{ marginTop: 7 }} />{e}</li>)}</ul>
              </div>
            </div>
            <div className="row wrap mt" style={{ gap: 6 }}>
              {h.indicators.map((k) => { const s = indicators.find((x) => x.key === k); return s && <span key={k} className="chip"><Icon name={s.icon} size={13} /> {s.short}</span> })}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

function Environments() {
  const [envs, setEnvs] = useState(null)
  const { active } = useCrew()
  useEffect(() => { api.environments().then(setEnvs) }, [])
  if (!envs) return <Loader />
  return (
    <div className="grid g-3">
      {envs.map((e) => (
        <Card key={e.key} hover style={active?.environment === e.key ? { borderColor: 'rgba(124,92,255,.7)', boxShadow: '0 0 40px -12px #7c5cff' } : undefined}>
          <div className="row"><Globe2 size={20} color="#22d3ee" /><h3 style={{ fontSize: 17 }}>{e.name}</h3></div>
          {active?.environment === e.key && <span className="pill s-nominal" style={{ marginTop: 8 }}>Your mission</span>}
          <dl className="kv mt">
            <dt>Gravity</dt><dd>{e.gravity_g === 0 ? 'Microgravity' : `${e.gravity_g} g`}</dd>
            <dt>Comms delay</dt><dd>{e.comm_delay}</dd>
            <dt>Daily dose</dt><dd>~{e.typical_dose_msv_day} mSv</dd>
            <dt>Evacuation</dt><dd>{e.evacuation}</dd>
          </dl>
          <p className="muted" style={{ marginBottom: 0 }}>{e.notes}</p>
        </Card>
      ))}
    </div>
  )
}
