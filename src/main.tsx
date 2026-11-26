import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/geist-sans'
import './index.css'
import './i18n'
import App from './App.tsx'
import { installPublicRouting } from './lib/public-routing'

installPublicRouting(import.meta.env.BASE_URL)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
