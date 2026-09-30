import { db, escribirMeta } from './db'
import type { Alumno, Dia, Ejercicio, Registro, Rutina } from './tipos'
import { esFechaISO, hoy } from './util'

export interface Copia {
  app: 'gym-rutinas'
  version: 1
  exportado: string
  alumnos: Alumno[]
  registros: Registro[]
}

export interface ResultadoRestauracion {
  alumnosNuevos: number
  alumnosActualizados: number
  registrosNuevos: number
  registrosActualizados: number
}

export const META_ULTIMA_COPIA = 'ultimaCopia'

export async function armarCopia(): Promise<Copia> {
  const [alumnos, registros] = await db.transaction('r', db.alumnos, db.registros, () => Promise.all([db.alumnos.toArray(), db.registros.toArray()]))
  return { app: 'gym-rutinas', version: 1, exportado: new Date().toISOString(), alumnos, registros }
}

/**
 * Chrome en Android no comparte archivos .json (solo pdf, imágenes, txt...): para mandarla
 * por WhatsApp o Drive va como .txt. El contenido es el mismo y Restaurar acepta los dos.
 */
export function archivoDeCopia(copia: Copia, formato: 'json' | 'txt' = 'json'): File {
  return new File([JSON.stringify(copia)], `rutinas-copia-${hoy()}.${formato}`, {
    type: formato === 'json' ? 'application/json' : 'text/plain',
  })
}

export async function marcarCopiaHecha(): Promise<void> {
  await escribirMeta(META_ULTIMA_COPIA, hoy())
}

// ---------- Validación del archivo ----------

type Obj = Record<string, unknown>

const esObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const esTexto = (x: unknown): x is string => typeof x === 'string'
const esNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function leerEjercicio(x: unknown): Ejercicio | null {
  if (!esObj(x) || !esTexto(x.id) || !esTexto(x.nombre) || !esNum(x.series)) return null
  return {
    id: x.id,
    nombre: x.nombre,
    series: x.series,
    reps: esTexto(x.reps) ? x.reps : '',
    descanso: esTexto(x.descanso) ? x.descanso : '',
    indicaciones: esTexto(x.indicaciones) ? x.indicaciones : '',
  }
}

function leerDia(x: unknown): Dia | null {
  if (!esObj(x) || !esTexto(x.id) || !esTexto(x.nombre) || !Array.isArray(x.ejercicios)) return null
  const ejercicios = x.ejercicios.map(leerEjercicio)
  if (ejercicios.some((e) => e === null)) return null
  return { id: x.id, nombre: x.nombre, ejercicios: ejercicios as Ejercicio[] }
}

function leerRutina(x: unknown): Rutina | null {
  if (!esObj(x) || !esTexto(x.id) || !esTexto(x.nombre) || !Array.isArray(x.dias)) return null
  const dias = x.dias.map(leerDia)
  if (dias.some((d) => d === null)) return null
  return {
    id: x.id,
    nombre: x.nombre,
    creada: esFechaISO(x.creada as string) ? (x.creada as string) : hoy(),
    activa: x.activa === true,
    dias: dias as Dia[],
  }
}

function leerAlumno(x: unknown): Alumno | null {
  if (!esObj(x) || !esTexto(x.id) || !esTexto(x.nombre) || !Array.isArray(x.rutinas)) return null
  const rutinas = x.rutinas.map(leerRutina)
  if (rutinas.some((r) => r === null)) return null
  return {
    id: x.id,
    nombre: x.nombre,
    notas: esTexto(x.notas) ? x.notas : '',
    rutinas: rutinas as Rutina[],
    creado: esNum(x.creado) ? x.creado : 0,
    actualizado: esNum(x.actualizado) ? x.actualizado : 0,
  }
}

function leerRegistro(x: unknown): Registro | null {
  if (
    !esObj(x) ||
    !esTexto(x.id) ||
    !esTexto(x.alumnoId) ||
    !esTexto(x.ejercicioId) ||
    !esTexto(x.clave) ||
    !esTexto(x.fecha) ||
    !esFechaISO(x.fecha) ||
    !Array.isArray(x.pesos) ||
    !x.pesos.every((p) => p === null || esNum(p))
  ) {
    return null
  }
  return {
    id: x.id,
    alumnoId: x.alumnoId,
    ejercicioId: x.ejercicioId,
    clave: x.clave,
    nombre: esTexto(x.nombre) ? x.nombre : x.clave,
    fecha: x.fecha,
    pesos: x.pesos as (number | null)[],
    nota: esTexto(x.nota) ? x.nota : '',
    actualizado: esNum(x.actualizado) ? x.actualizado : 0,
  }
}

const NO_ES_COPIA = 'Ese archivo no es una copia de Rutinas.'

export function leerCopia(texto: string): Copia {
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch {
    throw new Error(NO_ES_COPIA)
  }
  if (!esObj(crudo) || crudo.app !== 'gym-rutinas' || !Array.isArray(crudo.alumnos) || !Array.isArray(crudo.registros)) {
    throw new Error(NO_ES_COPIA)
  }
  if (crudo.version !== 1) throw new Error('La copia es de una versión más nueva de la app. Actualizá la app y probá de nuevo.')
  const alumnos = crudo.alumnos.map(leerAlumno)
  const registros = crudo.registros.map(leerRegistro)
  if (alumnos.some((a) => a === null) || registros.some((r) => r === null)) {
    throw new Error('La copia está dañada: tiene datos que no se pueden leer.')
  }
  return {
    app: 'gym-rutinas',
    version: 1,
    exportado: esTexto(crudo.exportado) ? crudo.exportado : '',
    alumnos: alumnos as Alumno[],
    registros: registros as Registro[],
  }
}

/**
 * Suma la copia a lo que ya hay. Si algo está en los dos lados, queda la versión
 * modificada más recientemente, así restaurar una copia vieja no pisa lo nuevo.
 */
export async function restaurarCopia(copia: Copia): Promise<ResultadoRestauracion> {
  const res: ResultadoRestauracion = { alumnosNuevos: 0, alumnosActualizados: 0, registrosNuevos: 0, registrosActualizados: 0 }
  await db.transaction('rw', db.alumnos, db.registros, async () => {
    const alumnosActuales = new Map((await db.alumnos.toArray()).map((a) => [a.id, a.actualizado]))
    const alumnos = copia.alumnos.filter((a) => {
      const actual = alumnosActuales.get(a.id)
      if (actual === undefined) res.alumnosNuevos++
      else if (a.actualizado > actual) res.alumnosActualizados++
      else return false
      return true
    })
    await db.alumnos.bulkPut(alumnos)

    // Un registro por ejercicio y fecha: si la copia trae otro para el mismo día
    // (anotado en otro teléfono), gana el más reciente y el otro se borra.
    const porId = new Map<string, Registro>()
    const porEjercicioFecha = new Map<string, Registro>()
    for (const r of await db.registros.toArray()) {
      porId.set(r.id, r)
      porEjercicioFecha.set(`${r.ejercicioId}|${r.fecha}`, r)
    }
    const aGuardar: Registro[] = []
    const aBorrar: string[] = []
    for (const r of copia.registros) {
      const clave = `${r.ejercicioId}|${r.fecha}`
      const actual = porId.get(r.id) ?? porEjercicioFecha.get(clave)
      if (actual && r.actualizado <= actual.actualizado) continue
      if (!actual) res.registrosNuevos++
      else {
        res.registrosActualizados++
        if (actual.id !== r.id) aBorrar.push(actual.id)
      }
      porId.set(r.id, r)
      porEjercicioFecha.set(clave, r)
      aGuardar.push(r)
    }
    await db.registros.bulkDelete(aBorrar)
    await db.registros.bulkPut(aGuardar)
  })
  return res
}
