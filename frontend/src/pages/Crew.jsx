import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, KeyRound, LogOut, Pencil, Plus, ShieldCheck, Siren, Trash2, X } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Card, Page, useToast } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { useAuth } from '../lib/AuthContext'
import { api, setToken } from '../lib/api'
import Avatar from '../components/Avatar'
import PhotoEditor from '../components/PhotoEditor'
import { useDismiss } from '../lib/useDismiss'

const COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#60a5fa']
const EMPTY = { name: '', call_sign: '', role: 'Mission Specialist', agency: 'NASA', environment: 'station', mission_name: '',
  baseline_mass_kg: '', prior_career_dose_msv: 0, avatar_color: '#7c5cff', pin: '' }
const pinOk = (p) => /^\d{6}$/.test(p)

export default function Crew({ firstRun = false }) {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminCrew firstRun={firstRun} /> : <MyProfile />
}

// ------------------------------------------------------------------ Mission Control
function AdminCrew({ firstRun }) {
  const { crew, activeId, setActiveId, loadCrew, refresh } = useCrew()
  const toast = useToast()
  const [envs, setEnvs] = useState([])
  const [form, setForm] = useState(firstRun ? EMPTY : null)
  const [pinFor, setPinFor] = useState(null)
  const [photoFor, setPhotoFor] = useState(null)
  useEffect(() => { api.environments().then(setEnvs) }, [])
  const modalRef = useRef(null)
  const closeForm = useCallback(() => setForm(null), [])
  useDismiss(modalRef, !!form && !firstRun, closeForm) // Escape or a click outside closes the window

  async function save() {
    const body = { ...form, baseline_mass_kg: form.baseline_mass_kg === '' ? null : Number(form.baseline_mass_kg), prior_career_dose_msv: Number(form.prior_career_dose_msv || 0) }
    const id = body.id
    delete body.id; delete body.created_at; delete body.has_pin
    try {
      if (id) { delete body.pin; await api.updateAstronaut(id, body) }
      else { const a = await api.createAstronaut(body); setActiveId(a.id) }
      toast(id ? 'Profile updated' : `Welcome aboard, ${body.name.split(' ')[0]}! Their PIN is ready.`)
      setForm(null)
      await loadCrew()
      refresh()
    } catch (e) { toast(e.message, 'warn') }
  }
  async function remove(a) {
    if (!window.confirm(`Delete ${a.name} and all their health data?`)) return
    await api.deleteAstronaut(a.id)
    toast(`${a.name} removed`, 'info')
    loadCrew()
  }

  const envName = (k) => envs.find((e) => e.key === k)?.name || k
  const f = (k) => ({ value: form?.[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) })
  const creating = form && !form.id

  return (
    <Page>
      <TopBar title={firstRun ? 'Welcome to AstroPulse' : 'Crew'} subtitle={firstRun ? 'Create the first astronaut profile to begin' : 'Add, edit or remove astronauts and manage their PINs'}>
        {!firstRun && <button className="btn primary" onClick={() => setForm(EMPTY)}><Plus size={16} /> Add astronaut</button>}
      </TopBar>

      <div className="grid g-3">
        {crew.map((a) => (
          <Card key={a.id} hover onClick={() => setActiveId(a.id)} style={{ cursor: 'pointer', ...(a.id === activeId ? { borderColor: a.avatar_color, boxShadow: `0 0 40px -12px ${a.avatar_color}` } : {}) }}>
            <div className="row">
              <button className="avatar-edit" title="Change photo" onClick={(e) => { e.stopPropagation(); setPhotoFor(a) }}>
                <Avatar person={a} size={58} />
                <span className="cam"><Camera size={13} /></span>
              </button>
              <div>
                <h3 style={{ fontSize: 18 }}>{a.name}</h3>
                <div className="faint">“{a.call_sign || '—'}” · {a.role} · {a.agency}</div>
              </div>
            </div>
            <dl className="kv mt">
              <dt>Mission</dt><dd>{a.mission_name || '—'}</dd>
              <dt>Location</dt><dd>{envName(a.environment)}</dd>
              <dt>Started</dt><dd>{a.mission_start}</dd>
              <dt>Baseline mass</dt><dd>{a.baseline_mass_kg ? `${a.baseline_mass_kg} kg` : '—'}</dd>
              <dt>Login</dt><dd>{a.has_pin ? <span style={{ color: 'var(--nominal)' }}>PIN set</span> : <span style={{ color: 'var(--caution)' }}>No PIN: can't log in</span>}</dd>
            </dl>
            <div className="row mt">
              {a.id === activeId ? <span className="pill s-nominal">Viewing</span> : <span className="faint">Click to view</span>}
              <div style={{ flex: 1 }} />
              <button className="btn ghost sm" title="Change photo" onClick={(e) => { e.stopPropagation(); setPhotoFor(a) }}><Camera size={14} /></button>
              <button className="btn ghost sm" title={a.has_pin ? 'Reset PIN' : 'Set PIN'} onClick={(e) => { e.stopPropagation(); setPinFor(a) }}><KeyRound size={14} /></button>
              <button className="btn ghost sm" title="Edit" onClick={(e) => { e.stopPropagation(); setForm({ ...a, baseline_mass_kg: a.baseline_mass_kg ?? '' }) }}><Pencil size={14} /></button>
              <button className="btn ghost sm" title="Delete" onClick={(e) => { e.stopPropagation(); remove(a) }}><Trash2 size={14} /></button>
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {form && (
          <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !firstRun && setForm(null)}>
            <motion.div ref={modalRef} className="glass pad modal" initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} onClick={(e) => e.stopPropagation()}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 22 }}>{form.id ? 'Edit profile' : 'New astronaut'}</h2>
                {!firstRun && <button className="btn ghost sm" onClick={() => setForm(null)}><X size={16} /></button>}
              </div>
              <div className="grid g-2 mt">
                <div className="field"><label>Full name</label><input className="input" {...f('name')} placeholder="Alex Rivera" /></div>
                <div className="field"><label>Call sign</label><input className="input" {...f('call_sign')} placeholder="FALCON" /></div>
                <div className="field"><label>Role</label><input className="input" {...f('role')} /></div>
                <div className="field"><label>Agency</label>
                  <select className="input" {...f('agency')}>{['NASA', 'ESA', 'JAXA', 'CSA', 'Roscosmos', 'ISRO', 'Commercial'].map((x) => <option key={x}>{x}</option>)}</select></div>
                <div className="field"><label>Mission</label><input className="input" {...f('mission_name')} placeholder="Artemis IV" /></div>
                <div className="field"><label>Environment</label>
                  <select className="input" {...f('environment')}>{envs.map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}</select></div>
                <div className="field"><label>Pre-flight body mass (kg)</label><input className="input" type="number" {...f('baseline_mass_kg')} placeholder="72.5" /></div>
                <div className="field"><label>Prior career dose (mSv)</label><input className="input" type="number" {...f('prior_career_dose_msv')} /></div>
              </div>
              {creating && (
                <div className="field mt"><label>6-digit PIN for login</label>
                  <input className="input" inputMode="numeric" maxLength={6} {...f('pin')} placeholder="e.g. 482915"
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                  <span className="faint">Give this PIN to the astronaut privately. It is stored scrambled (hashed), so nobody can read it later.</span>
                </div>
              )}
              <div className="field mt"><label>Color</label>
                <div className="row">{COLORS.map((c) => (
                  <motion.div key={c} whileHover={{ scale: 1.15 }} onClick={() => setForm({ ...form, avatar_color: c })}
                    style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', outline: form.avatar_color === c ? '2px solid #fff' : 'none', outlineOffset: 2 }} />
                ))}</div>
              </div>
              <button className="btn primary mt-l" style={{ width: '100%' }} disabled={!form.name || (creating && !pinOk(form.pin))} onClick={save}>
                {form.id ? 'Save changes' : 'Launch profile'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{pinFor && <PinModal astro={pinFor} onClose={() => { setPinFor(null); loadCrew() }} />}</AnimatePresence>
      <AnimatePresence>
        {photoFor && <PhotoEditor person={photoFor} title={`Photo for ${photoFor.name}`} onClose={() => setPhotoFor(null)}
          onSave={async (blob) => { await api.uploadPhoto(photoFor.id, blob); await loadCrew(); toast('Photo saved') }}
          onRemove={async () => { await api.deletePhoto(photoFor.id); await loadCrew(); toast('Photo removed', 'info') }} />}
      </AnimatePresence>
    </Page>
  )
}

function PinModal({ astro, onClose }) {
  const toast = useToast()
  const [pin, setPin] = useState('')
  const ref = useRef(null)
  useDismiss(ref, true, onClose)
  async function save() {
    try { await api.setPin(astro.id, pin); toast(`New PIN set for ${astro.name}. Their other devices were logged out.`); onClose() }
    catch (e) { toast(e.message, 'warn') }
  }
  return (
    <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div ref={ref} className="glass pad modal" style={{ width: 'min(420px,100%)' }} initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}>
        <h2 style={{ fontSize: 20 }} className="row"><KeyRound size={20} /> {astro.has_pin ? 'Reset' : 'Set'} PIN for {astro.name}</h2>
        <p className="muted">Use this when an astronaut forgot their PIN or is locked out. Any device logged in with the old PIN is logged out.</p>
        <input className="input big-input" inputMode="numeric" maxLength={6} value={pin} autoFocus placeholder="••••••"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <button className="btn primary mt" style={{ width: '100%' }} disabled={!pinOk(pin)} onClick={save}>Save PIN</button>
      </motion.div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ Astronaut: My Profile
function MyProfile() {
  const { crew, loadCrew } = useCrew()
  const { me, logout, loadMe } = useAuth()
  const toast = useToast()
  const self = crew.find((a) => a.id === me.id)
  const [envs, setEnvs] = useState([])
  const [callSign, setCallSign] = useState('')
  const [pins, setPins] = useState({ current: '', next: '', confirm: '' })
  const [photo, setPhoto] = useState(false)
  useEffect(() => { api.environments().then(setEnvs) }, [])
  useEffect(() => { if (self) setCallSign(self.call_sign || '') }, [self?.id]) // eslint-disable-line
  if (!self) return null

  async function saveLook(changes) {
    try { await api.updateAstronaut(self.id, changes); await loadCrew(); toast('Profile updated') } catch (e) { toast(e.message, 'warn') }
  }
  async function changePin() {
    if (pins.next !== pins.confirm) return toast('The new PINs do not match', 'warn')
    try {
      const r = await api.changePin(pins.current, pins.next)
      setToken(r.token) // the old pass stops working after a PIN change, so keep the new one
      await loadMe()
      setPins({ current: '', next: '', confirm: '' })
      toast('PIN changed. Other devices were logged out.')
    } catch (e) { toast(e.message, 'warn') }
  }
  async function logoutAll() {
    if (!window.confirm('Log out on every device, including this one?')) return
    await api.logoutEverywhere().catch(() => {})
    logout()
  }
  const pinField = (k, label) => (
    <div className="field"><label>{label}</label>
      <input className="input" type="password" inputMode="numeric" maxLength={6} value={pins[k]} placeholder="••••••"
        onChange={(e) => setPins({ ...pins, [k]: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></div>
  )
  const envName = envs.find((e) => e.key === self.environment)?.name || self.environment
  const onMe = (me.emergency_on_me || [])

  return (
    <Page>
      <TopBar title="My Profile" subtitle="Your details, your PIN and who has accessed your record" />
      <AnimatePresence>
        {photo && <PhotoEditor person={self} title="My photo" onClose={() => setPhoto(false)}
          onSave={async (blob) => { await api.uploadPhoto(self.id, blob); await loadCrew(); await loadMe(); toast('Photo saved') }}
          onRemove={async () => { await api.deletePhoto(self.id); await loadCrew(); await loadMe(); toast('Photo removed', 'info') }} />}
      </AnimatePresence>
      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="row">
            <button className="avatar-edit" title="Change my photo" onClick={() => setPhoto(true)}>
              <Avatar person={self} size={76} />
              <span className="cam"><Camera size={14} /></span>
            </button>
            <div><h2 style={{ fontSize: 22 }}>{self.name}</h2><div className="faint">{self.role} · {self.agency}</div>
              <button className="btn sm mt" style={{ marginTop: 8 }} onClick={() => setPhoto(true)}><Camera size={14} /> {self.photo_url ? 'Change photo' : 'Add photo'}</button></div>
          </div>
          <dl className="kv mt">
            <dt>Mission</dt><dd>{self.mission_name || '—'}</dd>
            <dt>Location</dt><dd>{envName}</dd>
            <dt>Started</dt><dd>{self.mission_start}</dd>
            <dt>Baseline mass</dt><dd>{self.baseline_mass_kg ? `${self.baseline_mass_kg} kg` : '—'}</dd>
          </dl>
          <p className="faint">Mission details are managed by Mission Control.</p>
          <div className="grid g-2 mt" style={{ alignItems: 'end' }}>
            <div className="field"><label>Call sign</label><input className="input" value={callSign} onChange={(e) => setCallSign(e.target.value)} /></div>
            <button className="btn" disabled={callSign === (self.call_sign || '')} onClick={() => saveLook({ call_sign: callSign })}>Save call sign</button>
          </div>
          <div className="field mt"><label>Color</label>
            <div className="row">{COLORS.map((c) => (
              <motion.div key={c} whileHover={{ scale: 1.15 }} onClick={() => saveLook({ avatar_color: c })}
                style={{ width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer', outline: self.avatar_color === c ? '2px solid #fff' : 'none', outlineOffset: 2 }} />
            ))}</div>
          </div>
        </Card>

        <div className="grid" style={{ gap: 18 }}>
          <Card>
            <div className="panel-title"><KeyRound size={18} color="#22d3ee" /> Change my PIN</div>
            <div className="grid g-3">{pinField('current', 'Current')}{pinField('next', 'New')}{pinField('confirm', 'Repeat new')}</div>
            <button className="btn primary mt" disabled={!pinOk(pins.current) || !pinOk(pins.next) || !pinOk(pins.confirm)} onClick={changePin}>Change PIN</button>
          </Card>
          <Card>
            <div className="panel-title"><Siren size={18} color="#fb7185" /> Emergency access to my record <span className="muted">last 7 days</span></div>
            {!onMe.length ? <div className="row muted"><ShieldCheck size={16} color="#34d399" /> Nobody has opened your record.</div> : (
              <ul className="list">{onMe.map((g) => (
                <li key={g.id}><Siren size={15} color="#fb7185" /><span><strong style={{ color: 'var(--text)' }}>{g.requester}</strong> · {new Date(g.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · “{g.reason}”</span></li>
              ))}</ul>
            )}
          </Card>
          <Card>
            <div className="panel-title"><LogOut size={18} /> Sessions</div>
            <p className="muted" style={{ marginTop: -6 }}>You stay signed in on this device until you log out. Lost a tablet? Log out everywhere.</p>
            <div className="row wrap">
              <button className="btn" onClick={logout}><LogOut size={15} /> Log out</button>
              <button className="btn danger" onClick={logoutAll}>Log out on all devices</button>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  )
}
