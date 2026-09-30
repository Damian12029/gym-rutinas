import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EnSala } from './db'
import { fechaISO } from './util'

// "En sala": los alumnos que el entrenador tiene entrenando a la vez, para pasar de
// uno a otro con un toque. Es de la clase de hoy: no va en la copia de seguridad.

export function rutaSesion(alumnoId: string, rutinaId: string, diaId: string): string {
  return `/alumno/${alumnoId}/dia/${rutinaId}/${diaId}`
}

/** Sin anotar nada en este tiempo, el alumno sale solo de la sala. */
const VENCE_MS = 3 * 60 * 60 * 1000

function vencido(e: EnSala, ahora: number): boolean {
  return ahora - e.actualizado > VENCE_MS || fechaISO(new Date(e.desde)) !== fechaISO(new Date(ahora))
}

export function useSala(): EnSala[] | undefined {
  return useLiveQuery(async () => {
    const ahora = Date.now()
    return (await db.sala.toArray()).filter((e) => !vencido(e, ahora)).sort((a, b) => a.desde - b.desde)
  })
}

/** Entra a la sala o, si ya estaba, actualiza el día que está haciendo. */
export async function entrarEnSala(alumnoId: string, rutinaId: string, diaId: string): Promise<void> {
  const ahora = Date.now()
  await db.transaction('rw', db.sala, async () => {
    const previo = await db.sala.get(alumnoId)
    const sigue = previo && !vencido(previo, ahora)
    await db.sala.put({ alumnoId, rutinaId, diaId, desde: sigue ? previo.desde : ahora, actualizado: ahora })
  })
}

export async function salirDeSala(alumnoId: string): Promise<void> {
  await db.sala.delete(alumnoId)
}

/** Anotar un peso cuenta como actividad: mientras se anota, no vence. */
export async function marcarActividad(alumnoId: string): Promise<void> {
  await db.sala.update(alumnoId, { actualizado: Date.now() })
}

export async function limpiarSala(): Promise<void> {
  const ahora = Date.now()
  const vencidos = (await db.sala.toArray()).filter((e) => vencido(e, ahora)).map((e) => e.alumnoId)
  if (vencidos.length) await db.sala.bulkDelete(vencidos)
}
