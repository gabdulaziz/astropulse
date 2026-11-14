import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Zap } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Card, Loader, Page, StatusPill } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { api } from '../lib/api'
import { Icon, STATUS_COLOR, formatValue } from '../lib/health'

// Where each body system's hotspot sits on the 300x410 figure
const SPOTS = {
  brain: [150, 30], eyes: [139, 50], ears: [175, 52], lungs: [128, 118], heart: [161, 126],
  immune: [80, 176], gut: [158, 190], kidneys: [124, 182], muscles: [129, 275], bones: [174, 335], skin: [222, 238],
}

function Figure({ status, selected, onSelect }) {
  const limb = (d, w) => (
    <g>
      <path d={d} stroke="rgba(34,211,238,.55)" strokeWidth={w} strokeLinecap="round" fill="none" />
      <path d={d} stroke="#0a1030" strokeWidth={w - 3} strokeLinecap="round" fill="none" />
      <path d={d} stroke="url(#holo)" strokeWidth={w - 3} strokeLinecap="round" fill="none" opacity=".35" />
    </g>
  )
  return (
    <svg viewBox="0 0 300 410">
      <defs>
        <linearGradient id="holo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity=".35" /><stop offset="1" stopColor="#7c5cff" stopOpacity=".15" />
        </linearGradient>
        <radialGradient id="floor"><stop offset="0" stopColor="#22d3ee" stopOpacity=".5" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <ellipse cx="150" cy="398" rx="80" ry="10" fill="url(#floor)" />
      <motion.ellipse cx="150" cy="398" rx="60" ry="7" fill="none" stroke="#22d3ee" strokeOpacity=".5"
        initial={{ rx: 50, opacity: 0.8 }} animate={{ rx: [50, 90], opacity: [0.8, 0] }} transition={{ duration: 2.4, repeat: Infinity }} />

      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} filter="url(#glow)">
        {/* arms and legs */}
        {limb('M112,96 Q92,110 88,150 L80,240', 22)}
        {limb('M188,96 Q208,110 212,150 L222,238', 22)}
        {limb('M134,222 L128,312 L124,388', 32)}
        {limb('M166,222 L172,312 L176,388', 32)}
        {/* neck + torso */}
        <rect x="139" y="70" width="22" height="22" rx="6" fill="#0a1030" stroke="rgba(34,211,238,.55)" strokeWidth="1.5" />
        <path d="M110,92 Q150,80 190,92 Q198,96 198,112 L192,160 Q188,196 188,232 Q150,244 112,232 Q112,196 108,160 L102,112 Q102,96 110,92 Z"
          fill="#0a1030" stroke="rgba(34,211,238,.6)" strokeWidth="1.5" />
        <path d="M110,92 Q150,80 190,92 Q198,96 198,112 L192,160 Q188,196 188,232 Q150,244 112,232 Q112,196 108,160 L102,112 Q102,96 110,92 Z" fill="url(#holo)" opacity=".5" />
        {/* head */}
        <ellipse cx="150" cy="44" rx="25" ry="30" fill="#0a1030" stroke="rgba(34,211,238,.6)" strokeWidth="1.5" />
        <ellipse cx="150" cy="44" rx="25" ry="30" fill="url(#holo)" opacity=".5" />
        {/* anatomy hints */}
        <path d="M150,96 L150,228" stroke="rgba(34,211,238,.25)" strokeDasharray="3 4" />
        {[108, 120, 132, 144].map((y) => <path key={y} d={`M${122 + (y - 108) / 6},${y} Q150,${y + 8} ${178 - (y - 108) / 6},${y}`} fill="none" stroke="rgba(34,211,238,.18)" />)}
        <path d="M120,200 Q150,212 180,200" fill="none" stroke="rgba(34,211,238,.18)" />
      </motion.g>

      {Object.entries(SPOTS).map(([key, [x, y]], i) => (
        <motion.g key={key} className={`hotspot s-${status[key] || 'unknown'} ${selected === key ? 'sel' : ''}`} onClick={() => onSelect(key)}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.05, type: 'spring' }}
          style={{ '--s': STATUS_COLOR[status[key] || 'unknown'] }}>
          <circle cx={x} cy={y} r="16" fill="transparent" />
          <circle className="ring" cx={x} cy={y} r="7" style={{ animationDelay: `${i * 0.2}s` }} />
          <circle className="core" cx={x} cy={y} r="6" />
          {selected === key && <circle cx={x} cy={y} r="13" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 3" />}
        </motion.g>
      ))}
    </svg>
  )
}

export default function BodyMap() {
  const { assessment: a } = useCrew()
  const [systems, setSystems] = useState([])
  const [sel, setSel] = useState('heart')
  const nav = useNavigate()
  useEffect(() => { api.bodySystems().then(setSystems) }, [])
  if (!a || !systems.length) return <Loader />

  const sys = systems.find((s) => s.key === sel)
  const st = a.body_status[sel] || 'unknown'
  const inds = a.indicators.filter((i) => sys.indicators.includes(i.key))

  return (
    <Page>
      <TopBar title="Body Map" subtitle="Click a glowing point to see how spaceflight affects that part of your body" />
      <div className="body-wrap">
        <Card className="body-stage" pad={false}>
          <div className="scanline" />
          <Figure status={a.body_status} selected={sel} onSelect={setSel} />
          <div className="row wrap" style={{ position: 'absolute', left: 16, top: 14, gap: 12 }}>
            {['nominal', 'caution', 'critical', 'unknown'].map((s) => (
              <span key={s} className={`row s-${s}`} style={{ gap: 6, fontSize: 12, color: 'var(--text-dim)' }}><span className="dot" />{s === 'unknown' ? 'no data' : s}</span>
            ))}
          </div>
        </Card>

        <AnimatePresence mode="wait">
          <motion.div key={sel} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35 }}>
            <div className="glass pad">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 26 }}>{sys.name}</h2>
                <StatusPill status={st} pulse={st === 'critical'} />
              </div>
              <p className="muted">{sys.function}</p>

              <div className="panel-title mt" style={{ fontSize: 14 }}><Zap size={16} color="#fbbf24" /> What spaceflight does</div>
              <ul className="list">
                {sys.space_effects.map((e, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <span className="dot s-caution" style={{ marginTop: 7 }} />{e}
                  </motion.li>
                ))}
              </ul>

              <div className="panel-title mt-l" style={{ fontSize: 14 }}>Your linked indicators</div>
              <div className="grid g-3" style={{ gap: 10 }}>
                {inds.map((i) => (
                  <motion.div key={i.key} whileHover={{ y: -3 }} className={`due-item s-${i.status}`} style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }} onClick={() => nav(`/trends?i=${i.key}`)}>
                    <span className="row" style={{ gap: 6, fontSize: 12, color: 'var(--text-dim)' }}><Icon name={i.icon} size={14} color={STATUS_COLOR[i.status]} />{i.short}</span>
                    <strong style={{ fontFamily: 'var(--font-head)', fontSize: 20 }}>{formatValue(i)} <span className="faint">{i.key !== 'mood' && i.value != null && i.unit}</span></strong>
                  </motion.div>
                ))}
              </div>

              <div className="panel-title mt-l" style={{ fontSize: 14 }}><ShieldCheck size={16} color="#34d399" /> Countermeasures</div>
              <ul className="list">
                {sys.countermeasures.map((c, i) => <li key={i}><ShieldCheck size={15} color="#34d399" />{c}</li>)}
              </ul>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="row wrap mt" style={{ gap: 8 }}>
        {systems.map((s) => (
          <button key={s.key} className={`btn sm ${sel === s.key ? 'primary' : ''}`} onClick={() => setSel(s.key)}>
            <span className={`dot s-${a.body_status[s.key]}`} /> {s.name}
          </button>
        ))}
      </div>
    </Page>
  )
}
