import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Info, Rocket, Trash2, Upload } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Burst, Card, Page, StatusPill, Tabs, useToast } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { api } from '../lib/api'
import { Icon, MOODS, STATUS_COLOR, evaluate, timeAgo } from '../lib/health'

export default function CheckIn() {
  const [tab, setTab] = useState('vitals')
  const { readOnly, active } = useCrew()
  if (readOnly) {
    return (
      <Page>
        <TopBar title="Health Check-in" subtitle="Emergency access is read-only" />
        <Card style={{ textAlign: 'center' }}>
          <Info size={36} color="#fb7185" />
          <h2 style={{ fontSize: 22, marginTop: 8 }}>Only {active?.name || 'this astronaut'} can log measurements</h2>
          <p className="muted">Emergency access lets you read {active?.name?.split(' ')[0] || 'their'}'s record, not change it. Use Mission Control, Body Map and Trends to assess them.</p>
        </Card>
      </Page>
    )
  }
  return (
    <Page>
      <TopBar title="Health Check-in" subtitle="Guided measurements with instructions for each step">
        <Tabs id="checkin" value={tab} onChange={setTab} tabs={[{ value: 'vitals', label: 'Vitals' }, { value: 'imaging', label: 'Imaging' }]} />
      </TopBar>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.25 }}>
          {tab === 'vitals' ? <VitalsFlow /> : <Imaging />}
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}

// ------------------------------------------------------------------ vitals
function VitalsFlow() {
  const { indicators, routine, active, refresh } = useCrew()
  const toast = useToast()
  const nav = useNavigate()
  const dueKeys = routine.filter((r) => r.due).map((r) => r.indicator)
  const [selected, setSelected] = useState(() => (dueKeys.length ? dueKeys : ['heart_rate', 'blood_pressure', 'mood']))
  const [phase, setPhase] = useState('select') // select | measure | done
  const [step, setStep] = useState(0)
  const [values, setValues] = useState({})
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [burst, setBurst] = useState(false)

  const specs = useMemo(() => indicators.filter((i) => selected.includes(i.key)), [indicators, selected])
  const spec = specs[step]

  const toggle = (k) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const setVal = (k, field, v) => setValues((old) => ({ ...old, [k]: { ...old[k], [field]: v } }))

  const statusFor = (s) => {
    const v = values[s.key] || {}
    return evaluate(s, v.value, v.value2, active?.baseline_mass_kg)
  }
  const isFilled = (s) => {
    const v = values[s.key] || {}
    return v.value !== undefined && v.value !== '' && (s.key !== 'blood_pressure' || (v.value2 !== undefined && v.value2 !== ''))
  }

  async function submit() {
    setSaving(true)
    try {
      const readings = specs.filter(isFilled).map((s) => ({
        indicator: s.key,
        value: Number(values[s.key].value),
        value2: s.key === 'blood_pressure' ? Number(values[s.key].value2) : null,
        notes: values[s.key].notes || '',
      }))
      const saved = await api.addReadings(active.id, readings)
      setResult(saved)
      setPhase('done')
      setBurst(true)
      setTimeout(() => setBurst(false), 2000)
      toast(`Check-in saved · +${saved.length * 5} XP`)
      refresh()
    } catch (e) {
      toast(e.message, 'warn')
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'select') {
    return (
      <Card>
        <div className="panel-title">What are you measuring today? <span className="muted">{dueKeys.length} due now</span></div>
        <div className="grid g-3">
          {indicators.map((s) => {
            const r = routine.find((x) => x.indicator === s.key)
            return (
              <motion.div key={s.key} whileTap={{ scale: 0.97 }} className={`pick ${selected.includes(s.key) ? 'on' : ''}`} onClick={() => toggle(s.key)}>
                <div className="ind-icon s-nominal" style={{ background: 'rgba(124,92,255,.15)', color: '#b9a8ff' }}><Icon name={s.icon} size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="faint">{r?.due ? <span style={{ color: 'var(--caution)' }}>Due now</span> : `Last: ${timeAgo(r?.last)}`}</div>
                </div>
                {selected.includes(s.key) && <CheckCircle2 size={20} color="#7c5cff" />}
              </motion.div>
            )
          })}
        </div>
        <div className="row mt-l">
          <button className="btn ghost" onClick={() => setSelected(indicators.map((i) => i.key))}>Select all</button>
          <div style={{ flex: 1 }} />
          <button className="btn primary" disabled={!selected.length} onClick={() => { setStep(0); setPhase('measure') }}>
            Begin · {selected.length} step{selected.length === 1 ? '' : 's'} <ArrowRight size={16} />
          </button>
        </div>
      </Card>
    )
  }

  if (phase === 'done') {
    return (
      <>
        <Burst show={burst} />
        <Card style={{ textAlign: 'center' }}>
          <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
            <Rocket size={56} color="#22d3ee" style={{ filter: 'drop-shadow(0 0 18px #22d3ee)' }} />
          </motion.div>
          <h2 style={{ fontSize: 28, marginTop: 10 }}>Check-in complete</h2>
          <p className="muted">+{result.length * 5} XP · data sent to Mission Control</p>
          <div className="grid g-3 mt" style={{ textAlign: 'left' }}>
            {result.map((r, i) => {
              const s = indicators.find((x) => x.key === r.indicator)
              return (
                <motion.div key={r.id} className={`alert s-${r.status}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.07 }}>
                  <h4><Icon name={s.icon} size={16} /> {s.short} <span style={{ marginLeft: 'auto' }}><StatusPill status={r.status} /></span></h4>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 700, marginTop: 6 }}>
                    {r.indicator === 'mood' ? MOODS[r.value - 1]?.e : r.value}{r.value2 != null && `/${r.value2}`} <span className="faint">{r.indicator !== 'mood' && s.unit}</span>
                  </div>
                  {r.status !== 'nominal' && <ul>{s.actions[r.status].map((a, j) => <li key={j}>{a}</li>)}</ul>}
                </motion.div>
              )
            })}
          </div>
          <div className="row mt-l" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => { setValues({}); setPhase('select') }}>New check-in</button>
            <button className="btn primary" onClick={() => nav('/')}>Back to Mission Control</button>
          </div>
        </Card>
      </>
    )
  }

  // phase === 'measure'
  const status = statusFor(spec)
  const v = values[spec.key] || {}
  const last = step === specs.length - 1
  return (
    <>
      <div className="stepper">
        {specs.map((s, i) => (
          <div key={s.key}><motion.span initial={false} animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }} transition={{ duration: 0.4 }} /></div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={spec.key} className="grid g-2"
          initial={{ opacity: 0, x: 60, rotateY: -8 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} exit={{ opacity: 0, x: -60, rotateY: 8 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <div className="glass pad">
            <div className="faint">Step {step + 1} of {specs.length}</div>
            <div className="row" style={{ marginTop: 6 }}>
              <div className={`ind-icon s-${status === 'unknown' ? 'unknown' : status}`} style={{ width: 44, height: 44 }}><Icon name={spec.icon} size={22} /></div>
              <h2 style={{ fontSize: 24 }}>{spec.name}</h2>
            </div>
            <p className="muted">{spec.why}</p>
            <div className="panel-title mt" style={{ fontSize: 14 }}>How to measure</div>
            <ol className="how">{spec.how_to.map((h, i) => <li key={i}>{h}</li>)}</ol>
            <div className="alert s-unknown mt" style={{ '--s': '#22d3ee' }}>
              <h4><Info size={16} /> In space</h4>
              <div className="muted" style={{ marginTop: 6 }}>{spec.in_space}</div>
            </div>
          </div>

          <div className="glass pad" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="panel-title" style={{ margin: 0 }}>Your reading</div>
              {status !== 'unknown' && <StatusPill status={status} pulse />}
            </div>

            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '20px 0' }}>
              {spec.key === 'mood' ? (
                <div>
                  <div className="mood-row">
                    {MOODS.map((m) => (
                      <motion.button key={m.v} whileTap={{ scale: 0.85 }} className={`mood ${Number(v.value) === m.v ? 'on' : ''}`} onClick={() => setVal('mood', 'value', m.v)} title={m.label}>{m.e}</motion.button>
                    ))}
                  </div>
                  <div className="muted" style={{ textAlign: 'center', marginTop: 12 }}>{MOODS.find((m) => m.v === Number(v.value))?.label || 'How do you feel today?'}</div>
                </div>
              ) : spec.key === 'blood_pressure' ? (
                <div className="row" style={{ gap: 12 }}>
                  <input className="input big-input" style={{ width: 150, borderColor: STATUS_COLOR[status] }} type="number" placeholder="120" value={v.value ?? ''} onChange={(e) => setVal(spec.key, 'value', e.target.value)} autoFocus />
                  <span style={{ fontSize: 40, color: 'var(--text-faint)' }}>/</span>
                  <input className="input big-input" style={{ width: 150, borderColor: STATUS_COLOR[status] }} type="number" placeholder="80" value={v.value2 ?? ''} onChange={(e) => setVal(spec.key, 'value2', e.target.value)} />
                  <span className="muted">mmHg</span>
                </div>
              ) : (
                <div className="row" style={{ gap: 12 }}>
                  <input className="input big-input" style={{ width: 220, borderColor: STATUS_COLOR[status] }} type="number" step={spec.input.step}
                    placeholder={spec.input.placeholder.replace('e.g. ', '')} value={v.value ?? ''} onChange={(e) => setVal(spec.key, 'value', e.target.value)} autoFocus />
                  <span className="muted" style={{ fontSize: 18 }}>{spec.unit}</span>
                </div>
              )}
            </div>

            <div className="faint" style={{ textAlign: 'center', marginBottom: 12 }}>
              Nominal range: {spec.relative ? `${spec.nominal[0]}% to +${spec.nominal[1]}% from baseline`
                : spec.key === 'blood_pressure' ? `${spec.nominal[0]}–${spec.nominal[1]} / ${spec.nominal2[0]}–${spec.nominal2[1]} mmHg`
                  : spec.key === 'mood' ? '3 to 5' : `${spec.nominal[0]}–${spec.nominal[1]} ${spec.unit}`}
            </div>

            <AnimatePresence>
              {status !== 'unknown' && status !== 'nominal' && (
                <motion.div className={`alert s-${status}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <h4>What to do</h4>
                  <ul>{spec.actions[status].map((a, i) => <li key={i}>{a}</li>)}</ul>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="field mt">
              <label>Notes (optional)</label>
              <input className="input" placeholder="Symptoms, context, time since exercise…" value={v.notes ?? ''} onChange={(e) => setVal(spec.key, 'notes', e.target.value)} />
            </div>

            <div className="row mt">
              <button className="btn ghost" onClick={() => (step === 0 ? setPhase('select') : setStep(step - 1))}><ArrowLeft size={16} /> Back</button>
              <div style={{ flex: 1 }} />
              {!last && <button className="btn" onClick={() => setStep(step + 1)}>Skip</button>}
              {last ? (
                <button className="btn primary" disabled={saving || !specs.some(isFilled)} onClick={submit}>{saving ? 'Transmitting…' : 'Submit check-in'} <Rocket size={16} /></button>
              ) : (
                <button className="btn primary" disabled={!isFilled(spec)} onClick={() => setStep(step + 1)}>Next <ArrowRight size={16} /></button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

// ------------------------------------------------------------------ imaging
const CATS = [
  { v: 'ultrasound', label: 'Ultrasound' }, { v: 'eye', label: 'Eye / vision' }, { v: 'skin', label: 'Skin / rash' },
  { v: 'wound', label: 'Wound' }, { v: 'other', label: 'Other' },
]

function Imaging() {
  const { active } = useCrew()
  const toast = useToast()
  const [images, setImages] = useState([])
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cat, setCat] = useState('skin')
  const [notes, setNotes] = useState('')
  const input = useRef()

  const load = () => api.images(active.id).then(setImages).catch(() => {})
  useEffect(() => { load() }, [active.id]) // eslint-disable-line

  function pick(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }
  async function upload() {
    const form = new FormData()
    form.append('astronaut_id', active.id)
    form.append('category', cat)
    form.append('notes', notes)
    form.append('file', file)
    try {
      await api.uploadImage(form)
      toast('Image logged to your health record')
      setFile(null); setPreview(null); setNotes('')
      load()
    } catch (e) { toast(e.message, 'warn') }
  }

  return (
    <div className="grid g-2">
      <Card>
        <div className="panel-title"><Camera size={18} color="#22d3ee" /> Capture an image</div>
        <p className="muted" style={{ marginTop: -6 }}>
          Photos help flight surgeons see changes over time: skin rashes, wounds, eye images, or ultrasound frames from a remote-guided scan.
          Take the same angle and lighting each time.
        </p>
        <div onClick={() => input.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
          style={{ border: '2px dashed var(--border-strong)', borderRadius: 16, minHeight: 220, display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden', background: 'rgba(6,8,26,.4)' }}>
          {preview ? <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: 300 }} /> : (
            <div style={{ textAlign: 'center' }} className="muted"><Upload size={32} /><div>Click, drop a file, or use your camera</div></div>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files[0])} />
        <div className="grid g-2 mt">
          <div className="field"><label>Type</label>
            <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select>
          </div>
          <div className="field"><label>Notes</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Location, size, symptoms" /></div>
        </div>
        <button className="btn primary mt" disabled={!file} onClick={upload}><Upload size={16} /> Save to record</button>
      </Card>
      <Card>
        <div className="panel-title">Image log <span className="muted">{images.length} image{images.length === 1 ? '' : 's'}</span></div>
        {!images.length && <div className="empty">No images yet.</div>}
        <div className="grid g-2">
          <AnimatePresence>
            {images.map((img) => (
              <motion.div key={img.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="glass" style={{ overflow: 'hidden' }}>
                <SecureImage path={img.url} alt={img.category} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', background: '#0a0d24' }} />
                <div style={{ padding: 10 }}>
                  <div className="row"><strong style={{ fontSize: 13, textTransform: 'capitalize' }}>{img.category}</strong>
                    <button className="btn ghost sm" style={{ marginLeft: 'auto', padding: 4 }} onClick={async () => { await api.deleteImage(img.id); load() }}><Trash2 size={14} /></button></div>
                  <div className="faint">{timeAgo(img.created_at)}{img.notes && ` · ${img.notes}`}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  )
}

// Health photos are private: load them with the login pass, then show a local copy.
function SecureImage({ path, ...props }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let url = null, alive = true
    api.imageBlobUrl(path).then((u) => { url = u; if (alive) setSrc(u); else URL.revokeObjectURL(u) }).catch(() => {})
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [path])
  return src ? <img src={src} {...props} /> : <div style={{ ...props.style }} />
}
