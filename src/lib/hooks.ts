import { useEffect, useState } from 'react'
import { hoy } from './util'

/**
 * Fecha de hoy que se recalcula cuando la app vuelve al frente. Si la pantalla quedó
 * abierta de un día para otro, lo primero que se anote va a la fecha correcta.
 * No cambia sola a la medianoche: una sesión que la cruza queda entera en su fecha.
 */
export function useHoy(): string {
  const [valor, setValor] = useState(hoy)
  useEffect(() => {
    const actualizar = () => {
      if (document.visibilityState === 'visible') setValor(hoy())
    }
    document.addEventListener('visibilitychange', actualizar)
    window.addEventListener('focus', actualizar)
    window.addEventListener('pageshow', actualizar)
    return () => {
      document.removeEventListener('visibilitychange', actualizar)
      window.removeEventListener('focus', actualizar)
      window.removeEventListener('pageshow', actualizar)
    }
  }, [])
  return valor
}
