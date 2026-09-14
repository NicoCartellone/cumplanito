import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './style.css'

// Auto-update: el runtime del plugin registra el SW y el sw.ts (skipWaiting+
// clientsClaim) se activa él solo con la versión nueva. Sin update-bar ni botón.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
