import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './style.css'

let updateSW: ReturnType<typeof registerSW>

updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent('pwa:need-refresh', {
        detail: { updateSW },
      }),
    )
  },
})

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
