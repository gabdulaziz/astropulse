import {
  Activity, Apple, Bike, ChartLine, Droplet, Dumbbell, Eye, Flame, Globe, Heart, Layers, Moon, Orbit,
  Radiation, Radio, Rocket, Scale, Smile, Star, Thermometer, Users, Wind,
} from 'lucide-react'

export const ICONS = {
  heart: Heart, activity: Activity, droplet: Droplet, thermometer: Thermometer, wind: Wind, moon: Moon,
  smile: Smile, scale: Scale, radiation: Radiation, dumbbell: Dumbbell, bike: Bike, apple: Apple, users: Users,
  globe: Globe, eye: Eye, radio: Radio, flame: Flame, orbit: Orbit, rocket: Rocket, layers: Layers,
  chart: ChartLine, star: Star,
}
export const Icon = ({ name, ...props }) => {
  const C = ICONS[name] || Activity
  return <C {...props} />
}

export const STATUS_COLOR = { nominal: '#34d399', caution: '#fbbf24', critical: '#fb7185', unknown: '#64748b' }
export const STATUS_LABEL = { nominal: 'Nominal', caution: 'Caution', critical: 'Critical', unknown: 'No data' }

export const MOODS = [
  { v: 1, e: '😣', label: 'Very low' },
  { v: 2, e: '😕', label: 'Low' },
  { v: 3, e: '😐', label: 'Okay' },
  { v: 4, e: '🙂', label: 'Good' },
  { v: 5, e: '😄', label: 'Great' },
]

// Same logic as the backend's health_engine.evaluate, used for the live preview while typing.
function band(v, nominal, caution) {
  if (v >= nominal[0] && v <= nominal[1]) return 'nominal'
  if (v >= caution[0] && v <= caution[1]) return 'caution'
  return 'critical'
}
const ORDER = { nominal: 0, caution: 1, critical: 2 }
export function evaluate(spec, value, value2, baseline) {
  if (value === '' || value == null || Number.isNaN(Number(value))) return 'unknown'
  let v = Number(value)
  if (spec.relative) {
    if (!baseline) return 'nominal'
    v = ((v - baseline) / baseline) * 100
  }
  let s = band(v, spec.nominal, spec.caution)
  if (spec.key === 'blood_pressure' && value2 !== '' && value2 != null) {
    const s2 = band(Number(value2), spec.nominal2, spec.caution2)
    if (ORDER[s2] > ORDER[s]) s = s2
  }
  return s
}

export function formatValue(ind) {
  if (ind.value == null) return '—'
  if (ind.key === 'blood_pressure') return `${Math.round(ind.value)}/${Math.round(ind.value2)}`
  if (ind.key === 'mood') return MOODS.find((m) => m.v === Math.round(ind.value))?.e || ind.value
  const n = Number(ind.value)
  return Number.isInteger(n) ? n : n.toFixed(n < 10 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, '')
}

export function timeAgo(iso) {
  if (!iso) return 'never'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export function initials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}
