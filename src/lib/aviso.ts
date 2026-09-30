import { useSyncExternalStore } from 'react'

export interface Aviso {
  id: number
  texto: string
  tipo: 'ok' | 'error'
}

let actual: Aviso | null = null
let siguienteId = 1
const suscriptos = new Set<() => void>()

function emitir() {
  for (const f of suscriptos) f()
}

export function avisar(texto: string, tipo: Aviso['tipo'] = 'ok'): void {
  const id = siguienteId++
  actual = { id, texto, tipo }
  emitir()
  setTimeout(
    () => {
      if (actual?.id === id) {
        actual = null
        emitir()
      }
    },
    tipo === 'error' ? 5000 : 2500,
  )
}

export function avisarError(e: unknown): void {
  avisar(e instanceof Error ? e.message : 'Algo salió mal', 'error')
}

export function useAviso(): Aviso | null {
  return useSyncExternalStore(
    (f) => {
      suscriptos.add(f)
      return () => suscriptos.delete(f)
    },
    () => actual,
  )
}
