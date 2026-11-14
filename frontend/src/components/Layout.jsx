import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen, ChevronDown, ClipboardPlus, LayoutDashboard, LogOut, Radar, PersonStanding, Satellite, ShieldAlert,
  Siren, Trophy, TrendingUp, UserRound, Users, X, Camera,
} from 'lucide-react'
import { useCrew } from '../lib/CrewContext'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'
import { useDismiss } from '../lib/useDismiss'
import { useToast } from './ui'
import Avatar from './Avatar'
import PhotoEditor from './PhotoEditor'

function navItems(isAdmin) {
  return [
    ...(isAdmin ? [{ to: '/overview', label: 'Crew Overview', icon: Radar }] : []),
    { to: '/', label: 'Mission Control', icon: LayoutDashboard },
    { to: '/check-in', label: 'Health Check-in', icon: ClipboardPlus, badge: 'due' },
    { to: '/body', label: 'Body Map', icon: PersonStanding },
    { to: '/trends', label: 'Trends', icon: TrendingUp },
    { to: '/quests', label: 'Quests', icon: Trophy },
    { to: '/guide', label: 'Health Guide', icon: BookOpen },
    isAdmin ? { to: '/crew', label: 'Crew', icon: Users } : { to: '/crew', label: 'My Profile', icon: UserRound },
  ]
}

function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#a855f7" /></linearGradient>
      </defs>
      <circle cx="32" cy="32" r="27" fill="none" stroke="url(#lg)" strokeWidth="3" opacity=".5" />
      <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }} style={{ originX: '32px', originY: '32px' }}>
        <circle cx="32" cy="5" r="4" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }} />
      </motion.g>
      <motion.path d="M12 34h10l5-12 8 22 6-14h11" fill="none" stroke="url(#lg)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1 }} />
    </svg>
  )
}

export function Sidebar() {
  const { routine, readOnly } = useCrew()
  const { isAdmin } = useAuth()
  const dueCount = readOnly ? 0 : routine.filter((r) => r.due).length
  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">Astro<span>Pulse</span></div>
          <div className="brand-sub">{isAdmin ? 'Mission Control' : 'Crew health'}</div>
        </div>
      </div>
      {navItems(isAdmin).map(({ to, label, icon: Icon, badge }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <Icon size={19} />
              <span className="label">{label}</span>
              {badge === 'due' && dueCount > 0 && <span className="nav-badge">{dueCount}</span>}
            </>
          )}
        </NavLink>
      ))}
      <div className="sidebar-foot">
        <div className="row" style={{ color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4 }}><Satellite size={14} /> NASA Space Apps 2026</div>
        Prototype for crew self-assessment. Not a medical device.
      </div>
    </aside>
  )
}

export function TopBar({ title, subtitle, children }) {
  const { progress, readOnly } = useCrew()
  const { isAdmin } = useAuth()
  const ownRecord = !isAdmin && !readOnly // XP belongs to the person looking at their own record
  return (
    <div className="topbar">
      <div>
        <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>{title}</motion.h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      <div className="spacer" />
      {children}
      {progress && ownRecord && (
        <div className="chip" title={`${progress.rank} · Level ${progress.level}`}>
          <strong className="gradient-text">LVL {progress.level}</strong> {progress.xp} XP
        </div>
      )}
      {isAdmin ? <AdminMenu /> : <AstronautMenu />}
    </div>
  )
}

// Shared open/close behaviour: click outside, Escape, or changing page closes the menu.
function useMenu() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  useEffect(() => { setOpen(false) }, [pathname])
  return { open, setOpen, ref, close }
}


function AdminMenu() {
  const { crew, active, setActiveId } = useCrew()
  const { me, logout, loadMe } = useAuth()
  const { open, setOpen, ref } = useMenu()
  const [photo, setPhoto] = useState(false)
  const nav = useNavigate()
  const self = { name: me.name, avatar_color: '#0e7490', photo_url: me.photo_url }
  return (
    <>
    <div className="crew-switch" ref={ref}>
      <button className="crew-btn" onClick={() => setOpen((o) => !o)}>
        <Avatar person={self} />
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div className="row" style={{ gap: 6 }}><span className="role-tag">MISSION CONTROL</span></div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{active ? `Viewing ${active.name}` : 'No astronaut selected'}</div>
        </div>
        <ChevronDown size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="crew-menu" initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}>
            {crew.map((a) => (
              <div key={a.id} className="crew-item" onClick={() => { setActiveId(a.id); setOpen(false) }}>
                <Avatar person={a} size={30} />
                <div><div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div><div className="faint">{a.role} · {a.agency}</div></div>
              </div>
            ))}
            <div className="crew-item" onClick={() => { setOpen(false); nav('/overview') }} style={{ color: 'var(--cyan)', fontWeight: 600, fontSize: 13 }}>Crew overview</div>
            <div className="crew-item" onClick={() => { setOpen(false); nav('/crew') }} style={{ color: 'var(--cyan)', fontWeight: 600, fontSize: 13 }}>+ Manage crew</div>
            <div className="crew-item" onClick={() => { setOpen(false); setPhoto(true) }} style={{ fontWeight: 600, fontSize: 13 }}><Camera size={15} /> My photo</div>
            <div className="crew-item" onClick={logout} style={{ color: 'var(--critical)', fontWeight: 600, fontSize: 13 }}><LogOut size={15} /> Log out</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <AnimatePresence>
      {photo && <PhotoEditor person={self} title="Mission Control photo" onClose={() => setPhoto(false)}
        onSave={async (blob) => { await api.uploadAdminPhoto(blob); await loadMe() }}
        onRemove={async () => { await api.deleteAdminPhoto(); await loadMe() }} />}
    </AnimatePresence>
    </>
  )
}

function AstronautMenu() {
  const { me, logout, viewing } = useAuth()
  const { crew } = useCrew()
  const self = crew.find((a) => a.id === me?.id)
  const { open, setOpen, ref } = useMenu()
  const [emergency, setEmergency] = useState(false)
  const nav = useNavigate()
  if (!self) return null
  return (
    <>
      <div className="crew-switch" ref={ref}>
        <button className="crew-btn" onClick={() => setOpen((o) => !o)}>
          <Avatar person={self} />
          <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{self.name}</div>
            <div className="faint">“{self.call_sign || self.role}”</div>
          </div>
          <ChevronDown size={16} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div className="crew-menu" initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}>
              <div className="crew-item" onClick={() => { setOpen(false); nav('/crew') }}><UserRound size={16} /> My profile & PIN</div>
              {!viewing && (
                <div className="crew-item" onClick={() => { setOpen(false); setEmergency(true) }} style={{ color: '#fda4af', fontWeight: 600 }}>
                  <Siren size={16} /> Emergency access
                </div>
              )}
              <div className="crew-item" onClick={logout} style={{ color: 'var(--critical)', fontWeight: 600 }}><LogOut size={16} /> Log out</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{emergency && <EmergencyModal onClose={() => setEmergency(false)} />}</AnimatePresence>
    </>
  )
}

// A crewmate opens another astronaut's record in an emergency: read-only, 60 minutes, always logged.
function EmergencyModal({ onClose }) {
  const { me, startEmergency } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [roster, setRoster] = useState([])
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useDismiss(ref, true, onClose)
  useEffect(() => { api.roster().then((r) => setRoster(r.filter((a) => a.id !== me.id))) }, [me.id])

  async function go() {
    setBusy(true)
    try {
      const g = await startEmergency(Number(target), reason)
      toast(`Emergency access to ${g.astronaut}'s record started. Mission Control has been notified.`, 'warn')
      onClose()
      nav('/')
    } catch (e) { toast(e.message, 'warn') } finally { setBusy(false) }
  }

  return (
    <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div ref={ref} className="glass pad modal" initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
        style={{ borderColor: 'rgba(251,113,133,.5)' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22, color: '#fda4af' }} className="row"><Siren size={22} /> Emergency access</h2>
          <button className="btn ghost sm" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="muted">
          Use this only when a crewmate needs help and you must see their health data. You get <strong>read-only</strong> access
          for <strong>60 minutes</strong>. Your name, the time and your reason are recorded, and both Mission Control and the crewmate will see it.
        </p>
        <div className="field mt"><label>Crewmate</label>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a crewmate…</option>
            {roster.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field mt"><label>Reason (required)</label>
          <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Diego fainted after exercise and is not responding normally" />
        </div>
        <button className="btn mt-l" style={{ width: '100%', background: 'linear-gradient(120deg,#e11d48,#fb7185)', border: 'none' }}
          disabled={!target || reason.trim().length < 5 || busy} onClick={go}>
          <ShieldAlert size={16} /> {busy ? 'Opening…' : 'Open record in emergency mode'}
        </button>
      </motion.div>
    </motion.div>
  )
}

// Red bar shown on every page while emergency access is in use, with a countdown.
export function EmergencyBanner() {
  const { viewing, endEmergency } = useAuth()
  const { active } = useCrew()
  const toast = useToast()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!viewing) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [viewing])
  const left = viewing ? new Date(viewing.expires_at).getTime() - now : 0
  useEffect(() => {
    if (viewing && left <= 0) { endEmergency(); toast('Emergency access ended (60 minutes passed).', 'info') }
  }, [viewing, left, endEmergency, toast])
  if (!viewing) return null
  const mins = Math.max(0, Math.floor(left / 60000)), secs = Math.max(0, Math.floor((left % 60000) / 1000))
  return (
    <motion.div className="emergency-bar" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}><Siren size={18} /></motion.span>
      {active && <Avatar person={active} size={28} />}
      <span><strong>EMERGENCY ACCESS</strong> · viewing <strong>{viewing.astronaut}</strong>'s record · read-only · logged</span>
      <span style={{ fontFamily: 'var(--font-mono)' }}>{mins}:{String(secs).padStart(2, '0')} left</span>
      <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => { endEmergency(); toast('Back to your own record', 'info') }}>End emergency access</button>
    </motion.div>
  )
}

// A "warp" sweep that plays on every page change: a glowing bar races across the top
// while streaks of light fly past, like jumping to hyperspace.
export function WarpOverlay() {
  const location = useLocation()
  return (
    <AnimatePresence mode="popLayout">
      <motion.div key={location.pathname}>
        <motion.div className="warp-bar" initial={{ width: '0%', opacity: 1 }} animate={{ width: '100%', opacity: [1, 1, 0] }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        <motion.div className="warp" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.9, delay: 0.1 }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span key={i}
              initial={{ x: '110vw', opacity: 0 }}
              animate={{ x: '-30vw', opacity: [0, 1, 0] }}
              transition={{ duration: 0.55 + Math.random() * 0.3, delay: Math.random() * 0.15, ease: 'easeIn' }}
              style={{
                position: 'absolute', top: `${5 + Math.random() * 90}%`, height: 2, width: 120 + Math.random() * 220, borderRadius: 2,
                background: `linear-gradient(90deg, transparent, ${['#22d3ee', '#a855f7', '#f472b6'][i % 3]})`,
              }} />
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
