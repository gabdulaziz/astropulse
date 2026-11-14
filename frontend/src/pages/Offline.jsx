import { motion } from 'framer-motion'
import { SatelliteDish } from 'lucide-react'
import { API_URL } from '../lib/api'

// Shown when the React app cannot reach the FastAPI backend.
export default function Offline({ error }) {
  return (
    <div className="loader">
      <motion.div animate={{ rotate: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 3 }}>
        <SatelliteDish size={64} color="#fb7185" />
      </motion.div>
      <h2>Lost signal with Mission Control</h2>
      <div className="muted" style={{ maxWidth: 520, textAlign: 'center' }}>
        The app can't reach the API at <code>{API_URL}</code> ({error}).<br />
        In a terminal: <code>cd backend && source .venv/bin/activate && uvicorn app.main:app --reload</code>
      </div>
      <button className="btn primary" onClick={() => window.location.reload()}>Retry uplink</button>
    </div>
  )
}
