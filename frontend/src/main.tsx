import { StrictMode } from 'react'
import { createRoot }  from 'react-dom/client'
import './index.css'
import App from './App'
import { restoreSession } from '@/persistence/sessionRestorer'

restoreSession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
