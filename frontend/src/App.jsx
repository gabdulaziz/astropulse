import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Starfield from './components/Starfield'
import { EmergencyBanner, Sidebar, WarpOverlay } from './components/Layout'
import { Loader } from './components/ui'
import { useAuth } from './lib/AuthContext'
import { useCrew } from './lib/CrewContext'
import Dashboard from './pages/Dashboard'
import CheckIn from './pages/CheckIn'
import BodyMap from './pages/BodyMap'
import Trends from './pages/Trends'
import Quests from './pages/Quests'
import Guide from './pages/Guide'
import Crew from './pages/Crew'
import Overview from './pages/Overview'
import Login from './pages/Login'
import Offline from './pages/Offline'

export default function App() {
  const location = useLocation()
  const { me, checking, isAdmin } = useAuth()
  const { loading, error, crew } = useCrew()

  // Not signed in: only the login screen
  if (checking || !me) {
    return (
      <>
        <Starfield />
        <AnimatePresence mode="wait">
          {checking
            ? <motion.div key="c" className="login-wrap"><Loader text="Checking your sign-in…" /></motion.div>
            : <motion.div key="l" exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}><Login /></motion.div>}
        </AnimatePresence>
      </>
    )
  }

  const noCrew = isAdmin && !crew.length
  let content
  if (loading && !noCrew) content = <Loader />
  else if (error && !crew.length && !noCrew) content = <Offline error={error} />
  else
    content = (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={noCrew ? <Crew firstRun /> : <Dashboard />} />
          <Route path="/overview" element={isAdmin ? <Overview /> : <Navigate to="/" replace />} />
          <Route path="/check-in" element={<CheckIn />} />
          <Route path="/body" element={<BodyMap />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/quests" element={<Quests />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/crew" element={<Crew firstRun={noCrew} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    )

  return (
    <>
      <Starfield />
      <WarpOverlay />
      <motion.div className="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <Sidebar />
        <main className="main">
          <EmergencyBanner />
          {content}
        </main>
      </motion.div>
    </>
  )
}
