import { useState } from 'react'
import { API_URL } from '../lib/api'
import { initials } from '../lib/health'

// One avatar used everywhere: the profile photo if there is one, otherwise coloured initials.
export default function Avatar({ person, size = 34, ring = true, style }) {
  const [broken, setBroken] = useState(null)
  if (!person) return null
  const color = person.avatar_color || '#7c5cff'
  const src = person.photo_url ? `${API_URL}${person.photo_url}` : null
  const showPhoto = src && broken !== src
  return (
    <span className="avatar" style={{
      width: size, height: size, fontSize: Math.max(11, size * 0.32), background: color, color,
      flexShrink: 0, overflow: 'hidden', boxShadow: ring ? undefined : 'none', ...style,
    }}>
      {showPhoto
        ? <img src={src} alt={person.name} onError={() => setBroken(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <span style={{ color: '#fff' }}>{initials(person.name)}</span>}
    </span>
  )
}
