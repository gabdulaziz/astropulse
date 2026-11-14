import { useEffect, useRef } from 'react'

// Animated, twinkling starfield with slow drift and the occasional shooting star.
export default function Starfield() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let w, h, stars, raf
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let shooting = null

    const resize = () => {
      w = canvas.width = window.innerWidth * dpr
      h = canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      const count = Math.floor((window.innerWidth * window.innerHeight) / 4200)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: (Math.random() * 1.2 + 0.2) * dpr,
        z: Math.random() * 0.8 + 0.2,
        t: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? 190 : 280) : 230,
      }))
    }
    resize()
    window.addEventListener('resize', resize)

    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.t += 0.02 * s.z
        s.x -= 0.06 * s.z * dpr
        if (s.x < 0) s.x = w
        const a = 0.35 + Math.sin(s.t) * 0.3 * s.z + 0.3 * s.z
        ctx.beginPath()
        ctx.fillStyle = `hsla(${s.hue}, 90%, 85%, ${a})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!shooting && Math.random() < 0.004) {
        shooting = { x: Math.random() * w, y: Math.random() * h * 0.4, vx: -(8 + Math.random() * 6) * dpr, vy: (3 + Math.random() * 2) * dpr, life: 1 }
      }
      if (shooting) {
        const { x, y, vx, vy, life } = shooting
        const g = ctx.createLinearGradient(x, y, x - vx * 10, y - vy * 10)
        g.addColorStop(0, `rgba(180, 240, 255, ${life})`)
        g.addColorStop(1, 'rgba(124, 92, 255, 0)')
        ctx.strokeStyle = g
        ctx.lineWidth = 2 * dpr
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx * 10, y - vy * 10); ctx.stroke()
        shooting.x += vx; shooting.y += vy; shooting.life -= 0.015
        if (shooting.life <= 0) shooting = null
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <>
      <div className="nebula" />
      <canvas ref={ref} className="starfield" />
    </>
  )
}
