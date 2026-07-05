import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { AuthProvider } from './context/auth'
import { ThemeProvider } from './context/theme'
import { captureTokenFromUrl } from './utils/auth'

// Persist the OAuth token BEFORE React mounts, so the session-start request
// (which fires from a child effect, ahead of the AuthProvider effect) already
// sees the token and the first post-login session is owned/eligible.
captureTokenFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
