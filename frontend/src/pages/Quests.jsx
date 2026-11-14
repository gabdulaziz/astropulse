import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Flame, Lock } from 'lucide-react'
import { TopBar } from '../components/Layout'
import { Burst, Card, Loader, Page, ScoreRing, useToast } from '../components/ui'
import { useCrew } from '../lib/CrewContext'
import { api } from '../lib/api'
import { Icon } from '../lib/health'

const CAT_COLOR = { fitness: '#f472b6', nutrition: '#34d399', rest: '#a855f7', mind: '#22d3ee', monitoring: '#fbbf24' }

export default function Quests() {
  const { progress: p, active, setProgress, refresh, readOnly, isAdmin } = useCrew()
  const locked = readOnly || isAdmin // only the astronaut can tick their own quests
  const toast = useToast()
  const [floating, setFloating] = useState(null)
  const [burst, setBurst] = useState(false)
  if (!p) return <Loader />

  const done = p.tasks.filter((t) => t.done).length
  const pct = Math.round((p.xp_into_level / p.xp_per_level) * 100)

  async function toggle(t) {
    if (locked) return toast(`Only ${active?.name?.split(' ')[0] || 'the astronaut'} can tick their own quests`, 'info')
    try {
      const res = await api.toggleTask(active.id, t.key)
      if (res.done) {
        setFloating({ key: t.key, xp: t.xp, id: Math.random() })
        if (res.progress.level > p.level) { setBurst(true); setTimeout(() => setBurst(false), 2000); toast(`Level up! You are now ${res.progress.rank}`) }
        if (res.progress.tasks.every((x) => x.done)) { setBurst(true); setTimeout(() => setBurst(false), 2000); toast('All quests complete today!') }
      }
      setProgress(res.progress)
      refresh()
    } catch (e) { toast(e.message, 'warn') }
  }

  return (
    <Page>
      <Burst show={burst} />
      <TopBar title="Quests" subtitle="Small daily actions that protect your body on a long mission" />
      <div className="grid hero">
        <Card className="row wrap" style={{ gap: 24 }}>
          <ScoreRing score={pct} suffix="%" size={170} label={`of the way to level ${p.level + 1}`} />
          <div>
            <div className="faint">Rank</div>
            <h2 style={{ fontSize: 28 }} className="gradient-text">{p.rank}</h2>
            <div className="muted">Level {p.level} · {p.xp} XP total</div>
            <div className="muted">{p.xp_per_level - p.xp_into_level} XP to next level</div>
          </div>
        </Card>
        <Card>
          <div className="faint">Check-in streak</div>
          <div className="row" style={{ marginTop: 8 }}>
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
              <Flame size={46} color="#fb923c" style={{ filter: 'drop-shadow(0 0 12px #fb923c)' }} />
            </motion.div>
            <div className="stat" style={{ fontSize: 44 }}>{p.streak}</div><div className="muted">days</div>
          </div>
          <p className="faint">Log at least one measurement every day to keep your streak.</p>
        </Card>
        <Card>
          <div className="faint">Today's quests</div>
          <div className="stat" style={{ fontSize: 44, marginTop: 8 }}>{done}<span className="muted" style={{ fontSize: 20 }}> / {p.tasks.length}</span></div>
          <div className="progress mt"><motion.div initial={{ width: 0 }} animate={{ width: `${(done / p.tasks.length) * 100}%` }} transition={{ type: 'spring', stiffness: 60 }} /></div>
          <p className="faint">{p.readings} measurements logged · {p.images} images</p>
        </Card>
      </div>

      <div className="grid g-2 mt-l" style={{ alignItems: 'start' }}>
        <Card>
          <div className="panel-title">Daily quests <span className="muted">{locked ? 'View only' : 'Resets at midnight'}</span></div>
          <div className="grid" style={{ gap: 10 }}>
            {p.tasks.map((t) => (
              <motion.div key={t.key} layout whileTap={{ scale: 0.98 }} className={`quest ${t.done ? 'done' : ''}`} onClick={() => toggle(t)}>
                <motion.div className="check" animate={t.done ? { scale: [1, 1.3, 1] } : {}}>{t.done && <Check size={16} strokeWidth={3} />}</motion.div>
                <Icon name={t.icon} size={20} color={CAT_COLOR[t.category]} />
                <div>
                  <div style={{ fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.7 : 1 }}>{t.title}</div>
                  <div className="faint">{t.description}</div>
                </div>
                <span className="xp-tag">+{t.xp} XP</span>
                <AnimatePresence>
                  {floating?.key === t.key && (
                    <motion.span key={floating.id} className="float-xp" initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -40 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}
                      onAnimationComplete={() => setFloating(null)}>+{floating.xp} XP</motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="panel-title">Mission badges <span className="muted">{p.badges.filter((b) => b.earned).length} / {p.badges.length}</span></div>
          <div className="grid g-3" style={{ gap: 12 }}>
            {p.badges.map((b, i) => (
              <motion.div key={b.key} className={`badge ${b.earned ? 'earned' : 'locked'}`} initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
                whileHover={b.earned ? { y: -4, rotate: [0, -3, 3, 0] } : {}}>
                <div className="medal">{b.earned ? <Icon name={b.icon} size={24} /> : <Lock size={20} />}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</div>
                <div className="faint">{b.description}</div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}
