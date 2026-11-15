import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { CrewProvider } from './lib/CrewContext'
import { ToastProvider } from './components/ui'
import { SourcesProvider } from './components/Sources'
import './styles.css'

// A fresh crew state for every login, so one person's data never leaks into the next session.
function PerUser({ children }) {
  const { me } = useAuth()
  return <CrewProvider key={me ? `${me.role}-${me.id}` : 'signed-out'}>{children}</CrewProvider>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SourcesProvider>
            <PerUser>
              <App />
            </PerUser>
          </SourcesProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
