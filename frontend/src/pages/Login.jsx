import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Delete, Lock, SatelliteDish, ShieldCheck } from 'lucide-react'
import { Tabs } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { api, API_URL } from '../lib/api'
import Avatar from '../components/Avatar'

const PIN_LENGTH = 6

export default function Login() {
  const [tab, setTab] = useState('astronaut')
  return (
    <div className="login-wrap">
      <motion.div className="glass login-card" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <div className="login-brand">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }} className="login-orbit">
            <span />
          </motion.div>
          <div>
            <div className="brand-name" style={{ fontSize: 30 }}>Astro<span>Pulse</span></div>
            <div className="brand-sub">Crew health · secure sign-in</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 22px' }}>
          <Tabs id="login" value={tab} onChange={setTab} tabs={[{ value: 'astronaut', label: 'Astronaut' }, { value: 'admin', label: 'Mission Control' }]} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            {tab === 'astronaut' ? <AstronautLogin /> : <AdminLogin />}
          </motion.div>
        </AnimatePresence>
        <p className="faint" style={{ textAlign: 'center', marginTop: 22, marginBottom: 0 }}>
          <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> You stay signed in on this device until you log out.
        </p>
      </motion.div>
    </div>
  )
}

function AstronautLogin() {
  const { loginAstronaut } = useAuth()
  const [roster, setRoster] = useState(null)
  const [offline, setOffline] = useState(false)
  const [who, setWho] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => { api.roster().then(setRoster).catch(() => setOffline(true)) }, [])
  // Free hosting puts the server to sleep when nobody uses it; the first visit wakes it up.
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t) }, [])

  async function submit(code) {
    setBusy(true); setError('')
    try {
      await loginAstronaut(who.id, code)
    } catch (e) {
      setError(e.message); setPin(''); setShake((s) => s + 1)
    } finally { setBusy(false) }
  }
  function press(d) {
    if (busy) return
    setError('')
    if (d === 'del') return setPin(pin.slice(0, -1))
    if (pin.length >= PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    if (next.length === PIN_LENGTH) submit(next) // sends automatically on the 6th digit
  }
  // keyboard support for the PIN pad
  useEffect(() => {
    if (!who) return
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Escape') { setWho(null); setPin(''); setError('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line

  if (offline) return <OfflineNote />
  if (!roster) return (
    <div className="muted" style={{ textAlign: 'center' }}>
      Loading crew…
      {slow && <div style={{ marginTop: 8, fontSize: 13 }}>Waking up Mission Control. The first visit after a quiet spell can take up to a minute.</div>}
    </div>
  )
  if (!roster.length) return <div className="muted" style={{ textAlign: 'center' }}>No astronauts yet. Mission Control must create the crew first.</div>

  if (!who) {
    return (
      <>
        <div className="muted" style={{ textAlign: 'center', marginBottom: 14 }}>Who is checking in?</div>
        <div className="login-grid">
          {roster.map((a, i) => (
            <motion.button key={a.id} className="login-person" onClick={() => { setWho(a); setPin('') }}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }}>
              <Avatar person={a} size={56} />
              <div style={{ fontWeight: 600, marginTop: 8 }}>{a.name}</div>
              <div className="faint">{a.has_pin ? `“${a.call_sign || '—'}”` : 'No PIN yet'}</div>
            </motion.button>
          ))}
        </div>
      </>
    )
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <button className="btn ghost sm" onClick={() => { setWho(null); setPin(''); setError('') }} style={{ marginBottom: 6 }}><ArrowLeft size={14} /> Not you?</button>
      <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
        <Avatar person={who} size={52} />
        <div style={{ textAlign: 'left' }}><div style={{ fontWeight: 700, fontSize: 17 }}>{who.name}</div><div className="faint">Enter your 6-digit PIN</div></div>
      </div>
      <motion.div key={shake} className="pin-dots" animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : {}} transition={{ duration: 0.4 }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <motion.span key={i} className={`pin-dot ${i < pin.length ? 'on' : ''}`} animate={i < pin.length ? { scale: [1, 1.35, 1] } : {}} />
        ))}
      </motion.div>
      <div style={{ minHeight: 22 }} className={error ? '' : 'faint'}>
        {error ? <span style={{ color: 'var(--critical)' }}>{error}</span> : busy ? 'Checking…' : 'Use the keypad or your keyboard'}
      </div>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => k === '' ? <span key={i} /> : (
          <motion.button key={i} className="pin-key" whileTap={{ scale: 0.88 }} onClick={() => press(k)} disabled={busy} aria-label={k === 'del' ? 'Delete' : k}>
            {k === 'del' ? <Delete size={20} /> : k}
          </motion.button>
        ))}
      </div>
      {!who.has_pin && <p className="faint">This astronaut has no PIN yet. Ask Mission Control to set one.</p>}
    </div>
  )
}

function AdminLogin() {
  const { loginAdmin } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { await loginAdmin(username, password) } catch (err) { setError(err.status ? err.message : 'Cannot reach the API') } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="grid" style={{ gap: 14 }}>
      <div className="field"><label htmlFor="mc-user">Username</label><input id="mc-user" className="input" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
      <div className="field"><label htmlFor="mc-pass">Password</label><input id="mc-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <div style={{ minHeight: 20, color: 'var(--critical)', fontSize: 14 }}>{error}</div>
      <button className="btn primary" disabled={busy || !username || !password}><Lock size={16} /> {busy ? 'Signing in…' : 'Sign in to Mission Control'}</button>
      <p className="faint" style={{ margin: 0 }}>Mission Control can see every astronaut's record. Sessions last 12 hours.</p>
    </form>
  )
}

function OfflineNote() {
  return (
    <div style={{ textAlign: 'center' }} className="muted">
      <SatelliteDish size={40} color="#fb7185" />
      <p>Can't reach the API at <code>{API_URL}</code>.</p>
      <p className="faint">Start the backend in a terminal, then refresh this page.</p>
    </div>
  )
}
