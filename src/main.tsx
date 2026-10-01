import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { escucharInstalacion } from './lib/instalar'
import { marcarVersionNueva, vigilarActualizaciones } from './lib/actualizacion'

escucharInstalacion()
// Guarda la app en el teléfono para que abra sin internet y se actualice sola.
registerSW({ immediate: true, onNeedReload: marcarVersionNueva, onRegisteredSW: (_url, r) => vigilarActualizaciones(r) })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
