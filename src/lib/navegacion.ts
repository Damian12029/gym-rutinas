import type { NavigationType } from 'react-router-dom'

// Copia de la pila de pantallas de esta visita. El navegador no deja ver las entradas
// anteriores del historial, y "atrás" necesita saber qué pantalla hay debajo.

interface Entrada {
  key: string
  ruta: string
}

const pila: Entrada[] = []
let actual = -1

export function registrarNavegacion(tipo: NavigationType, key: string, ruta: string): void {
  if (pila[actual]?.key === key) return
  if (tipo === 'POP') {
    const i = pila.findIndex((e) => e.key === key)
    if (i >= 0) actual = i
    else {
      pila.length = 0
      pila.push({ key, ruta })
      actual = 0
    }
    return
  }
  if (tipo === 'REPLACE' && actual >= 0) {
    pila[actual] = { key, ruta }
    return
  }
  pila.length = actual + 1
  pila.push({ key, ruta })
  actual = pila.length - 1
}

/** Ruta de la pantalla de abajo, o null si se entró directo a esta. */
export function rutaAnterior(): string | null {
  return actual > 0 ? pila[actual - 1].ruta : null
}

/** Cuántas pantallas hay que volver para llegar a `ruta`, o 0 si no está debajo. */
export function distanciaHasta(ruta: string): number {
  for (let i = actual - 1; i >= 0; i--) if (pila[i].ruta === ruta) return actual - i
  return 0
}
