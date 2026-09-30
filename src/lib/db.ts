import Dexie, { type EntityTable } from 'dexie'
import type { Alumno, Registro } from './tipos'

export interface Meta {
  clave: string
  valor: string
}

/** Alumno que está entrenando ahora y el día que está haciendo. Dura lo que dura la clase. */
export interface EnSala {
  alumnoId: string
  rutinaId: string
  diaId: string
  /** Llegada: ordena los botones de la barra. */
  desde: number
  /** Última vez que se anotó o se entró: pasadas unas horas sin nada, sale solo. */
  actualizado: number
}

class BaseRutinas extends Dexie {
  alumnos!: EntityTable<Alumno, 'id'>
  registros!: EntityTable<Registro, 'id'>
  meta!: EntityTable<Meta, 'clave'>
  sala!: EntityTable<EnSala, 'alumnoId'>

  constructor() {
    super('gym-rutinas')
    // Las rutinas, días y ejercicios viven anidados dentro del alumno: son pocos
    // y se editan juntos. Lo anotado en cada sesión va aparte porque crece sin límite.
    this.version(1).stores({
      alumnos: 'id, nombre',
      registros: 'id, alumnoId, ejercicioId, [alumnoId+clave], [alumnoId+fecha], [ejercicioId+fecha]',
      meta: 'clave',
    })
    this.version(2).stores({ sala: 'alumnoId' })
  }
}

export const db = new BaseRutinas()

export async function leerMeta(clave: string): Promise<string | undefined> {
  return (await db.meta.get(clave))?.valor
}

export async function escribirMeta(clave: string, valor: string): Promise<void> {
  await db.meta.put({ clave, valor })
}
