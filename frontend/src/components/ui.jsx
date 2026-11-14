import { motion, AnimatePresence } from 'framer-motion'
import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { STATUS_COLOR, STATUS_LABEL } from '../lib/health'

// ---- Page wrapper with entrance animation + staggered children
export const pageVariants = {
  initial: { opacity: 0, y: 30, scale: 0.98, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.06, delayChildren: 0.1 } },
  exit: { opacity: 0, y: -20, scale: 1.01, filter: 'blur(8px)', transition: { duration: 0.3, ease: 'easeIn' } },
}
export const itemVariants = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
}

export function Page({ children }) {
  return (
    <motion.div className="page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  )
}

// Each Card runs its own entrance animation. It must not wait for a parent animation:
// cards that mount later (after a tab switch or a data load) would otherwise stay invisible.
export function Card({ children, className = '', pad = true, hover = false, ...rest }) {
  return (
    <motion.div
      variants={itemVariants}
      initial="initial"
      animate="animate"
      whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : undefined}
      className={`glass ${pad ? 'pad' : ''} ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function StatusPill({ status, pulse = false }) {
  return (
    <span className={`pill s-${status}`}>
      <span className={`dot ${pulse ? 'pulse' : ''}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

// ---- Animated score ring
export function ScoreRing({ score = 0, status = 'nominal', size = 190, label = 'Health score', suffix = '' }) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = STATUS_COLOR[status]
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <CountUp value={`${score}${suffix}`} className="gradient-text" style={{ fontFamily: 'var(--font-head)', fontSize: size * 0.27, fontWeight: 700, lineHeight: 1 }} />
          <div className="faint" style={{ marginTop: 4 }}>{label}</div>
        </div>
      </div>
    </div>
  )
}

export function CountUp({ value, ...rest }) {
  return (
    <motion.div key={value} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }} {...rest}>
      {value}
    </motion.div>
  )
}

// ---- Sparkline
export function Sparkline({ data = [], color = '#7c5cff', width = 110, height = 34 }) {
  if (data.length < 2) return <svg width={width} height={height} />
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const id = `sg${color.replace('#', '')}`
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <motion.path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="3" fill={color} />
    </svg>
  )
}

// ---- Tabs with sliding pill
export function Tabs({ tabs, value, onChange, id = 'tabs' }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {value === t.value && <motion.span layoutId={`${id}-pill`} className="tab-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Loader({ text = 'Establishing uplink…' }) {
  return (
    <div className="loader">
      <div className="orbit-loader" />
      <div>{text}</div>
    </div>
  )
}

// ---- Toasts
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((text, kind = 'success') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const icon = { success: <CheckCircle2 size={18} color="#34d399" />, warn: <AlertTriangle size={18} color="#fbbf24" />, info: <Info size={18} color="#22d3ee" /> }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} className="toast" layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}>
              {icon[t.kind]}<div>{t.text}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ---- Confetti burst (for completed check-ins / quests)
export function Burst({ show }) {
  const colors = ['#22d3ee', '#7c5cff', '#f472b6', '#34d399', '#fbbf24']
  return (
    <AnimatePresence>
      {show && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90, display: 'grid', placeItems: 'center' }}>
          {Array.from({ length: 46 }).map((_, i) => {
            const a = (i / 46) * Math.PI * 2
            const d = 160 + Math.random() * 260
            return (
              <motion.span key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + 80, opacity: 0, scale: 0.4, rotate: 360 }}
                transition={{ duration: 1.4 + Math.random() * 0.6, ease: 'easeOut' }}
                style={{ position: 'absolute', width: 9, height: i % 3 ? 9 : 16, borderRadius: i % 2 ? 99 : 2, background: colors[i % colors.length] }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
