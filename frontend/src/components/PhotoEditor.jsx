import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, ImagePlus, Trash2, X, ZoomIn } from 'lucide-react'
import { useDismiss } from '../lib/useDismiss'
import Avatar from './Avatar'

const VIEW = 260   // size of the round preview on screen
const OUT = 256    // size of the saved photo (pixels)

// Choose a photo, zoom and drag it into the circle, save a small 256x256 square.
export default function PhotoEditor({ person, title = 'Profile photo', onSave, onRemove, onClose }) {
  const [img, setImg] = useState(null)        // the loaded picture
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const drag = useRef(null)
  const fileRef = useRef(null)
  const camRef = useRef(null)
  const boxRef = useRef(null)
  useDismiss(boxRef, true, () => !busy && onClose())

  function load(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please choose an image file')
    setError('')
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => { setImg(im); setZoom(1); setPos({ x: 0, y: 0 }) }
    im.onerror = () => setError('This image could not be opened')
    im.src = url
  }

  // "cover" scale: the picture always fills the whole circle
  const base = img ? Math.max(VIEW / img.width, VIEW / img.height) : 1
  const scale = base * zoom
  const w = img ? img.width * scale : 0
  const h = img ? img.height * scale : 0
  // keep the picture covering the circle while dragging/zooming
  const clamp = (p) => ({
    x: Math.min((w - VIEW) / 2, Math.max(-(w - VIEW) / 2, p.x)),
    y: Math.min((h - VIEW) / 2, Math.max(-(h - VIEW) / 2, p.y)),
  })
  useEffect(() => { setPos((p) => clamp(p)) }, [zoom, img]) // eslint-disable-line

  const onDown = (e) => { if (!img) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { sx: e.clientX, sy: e.clientY, ...pos } }
  const onMove = (e) => { if (drag.current) setPos(clamp({ x: drag.current.x + e.clientX - drag.current.sx, y: drag.current.y + e.clientY - drag.current.sy })) }
  const onUp = () => { drag.current = null }
  const onWheel = (e) => { if (img) setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.002))) }

  async function save() {
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUT; canvas.height = OUT
      const ctx = canvas.getContext('2d')
      const k = OUT / VIEW
      const left = (VIEW - w) / 2 + pos.x, top = (VIEW - h) / 2 + pos.y
      ctx.fillStyle = '#0a0d24'; ctx.fillRect(0, 0, OUT, OUT)
      ctx.drawImage(img, left * k, top * k, w * k, h * k)
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
      await onSave(blob)
      onClose()
    } catch (e) { setError(e.message || 'Upload failed') } finally { setBusy(false) }
  }
  async function remove() {
    setBusy(true)
    try { await onRemove(); onClose() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div ref={boxRef} className="glass pad modal" style={{ width: 'min(440px,100%)' }} initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 20 }}>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}><X size={16} /></button>
        </div>

        <div className="photo-stage" style={{ width: VIEW, height: VIEW }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
          {img ? (
            <img src={img.src} alt="" draggable={false} style={{
              position: 'absolute', width: w, height: h, left: (VIEW - w) / 2 + pos.x, top: (VIEW - h) / 2 + pos.y,
              cursor: drag.current ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none',
            }} />
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              <Avatar person={person} size={VIEW - 40} ring={false} />
            </div>
          )}
          <div className="photo-ring" />
        </div>

        {img ? (
          <div className="row mt" style={{ gap: 10 }}>
            <ZoomIn size={16} color="#a5abd6" />
            <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: '#7c5cff' }} aria-label="Zoom" />
          </div>
        ) : <p className="faint" style={{ textAlign: 'center' }}>Choose a photo, then zoom and drag to place the face in the circle.</p>}
        {img && <p className="faint" style={{ textAlign: 'center', margin: '6px 0 0' }}>Drag the photo to move it · scroll or use the slider to zoom</p>}
        {error && <p style={{ color: 'var(--critical)', fontSize: 14 }}>{error}</p>}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => load(e.target.files[0])} />
        <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => load(e.target.files[0])} />
        <div className="row wrap mt" style={{ gap: 8 }}>
          <button className="btn" onClick={() => fileRef.current.click()} disabled={busy}><ImagePlus size={16} /> {img ? 'Another photo' : 'Choose photo'}</button>
          <button className="btn" onClick={() => camRef.current.click()} disabled={busy}><Camera size={16} /> Camera</button>
          {person?.photo_url && !img && <button className="btn danger" onClick={remove} disabled={busy}><Trash2 size={16} /> Remove</button>}
        </div>
        <button className="btn primary mt" style={{ width: '100%' }} disabled={!img || busy} onClick={save}>{busy ? 'Saving…' : 'Save photo'}</button>
      </motion.div>
    </motion.div>
  )
}
