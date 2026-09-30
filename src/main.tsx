import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { escucharInstalacion } from './lib/instalar'
import { marcarVersionNueva, recargarSiSeguro } from './lib/actualizacion'

escucharInstalacion()
// Guarda la app en el teléfono para que abra sin internet y se actualice sola.
registerSW({ immediate: true, onNeedReload: marcarVersionNueva })
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') recargarSiSeguro()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
