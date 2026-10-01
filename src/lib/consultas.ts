import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Alumno, Dia, Registro, Rutina } from './tipos'
import { compararNombres, pesoMaximo } from './util'

// useLiveQuery devuelve undefined mientras carga; por eso "no existe" es null.

export function useAlumnos(): Alumno[] | undefined {
  return useLiveQuery(async () => (await db.alumnos.toArray()).sort((a, b) => compararNombres(a.nombre, b.nombre)))
}

export function useAlumno(id: string | undefined): Alumno | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.alumnos.get(id)) ?? null) : null), [id])
}

export interface UltimoRegistro {
  fecha: string
  ejercicioId: string
  actualizado: number
}

function masNuevo(r: UltimoRegistro, actual: UltimoRegistro | undefined): boolean {
  return !actual || r.fecha > actual.fecha || (r.fecha === actual.fecha && r.actualizado > actual.actualizado)
}

/** Lo último anotado de cada alumno: cuándo vino y qué día hizo. */
export function useUltimosRegistros(): Map<string, UltimoRegistro> | undefined {
  return useLiveQuery(async () => {
    const mapa = new Map<string, UltimoRegistro>()
    await db.registros.each((r) => {
      if (masNuevo(r, mapa.get(r.alumnoId))) mapa.set(r.alumnoId, { fecha: r.fecha, ejercicioId: r.ejercicioId, actualizado: r.actualizado })
    })
    return mapa
  })
}

export function ultimoRegistro(registros: Registro[]): UltimoRegistro | undefined {
  let ultimo: UltimoRegistro | undefined
  for (const r of registros) if (masNuevo(r, ultimo)) ultimo = r
  return ultimo
}

/**
 * El día de la rutina que le toca. Si está en sala, el que abrió (aunque todavía no haya
 * anotado nada); si hoy ya anotó algo, ese; si no, el siguiente al último que hizo
 * (vuelve al primero después del último).
 */
export function diaQueLeToca(
  rutina: Rutina,
  ultimo: UltimoRegistro | undefined,
  hoyISO: string,
  enSala?: { rutinaId: string; diaId: string },
): Dia | undefined {
  const dias = rutina.dias.filter((d) => d.ejercicios.length > 0)
  if (dias.length === 0) return undefined
  const abierto = enSala?.rutinaId === rutina.id ? dias.find((d) => d.id === enSala.diaId) : undefined
  if (abierto) return abierto
  const i = ultimo ? dias.findIndex((d) => d.ejercicios.some((e) => e.id === ultimo.ejercicioId)) : -1
  if (i < 0) return dias[0]
  return ultimo && ultimo.fecha === hoyISO ? dias[i] : dias[(i + 1) % dias.length]
}

export function useRegistrosAlumno(alumnoId: string | undefined): Registro[] | undefined {
  return useLiveQuery(async () => (alumnoId ? await db.registros.where('alumnoId').equals(alumnoId).toArray() : []), [alumnoId])
}

export interface HistorialEjercicio {
  clave: string
  nombre: string
  /** Ordenado por fecha ascendente. */
  registros: Registro[]
}

/** Agrupa lo anotado por ejercicio (clave), sin importar la rutina. */
export function agruparPorEjercicio(registros: Registro[]): Map<string, HistorialEjercicio> {
  const mapa = new Map<string, HistorialEjercicio>()
  for (const r of registros) {
    let h = mapa.get(r.clave)
    if (!h) {
      h = { clave: r.clave, nombre: r.nombre, registros: [] }
      mapa.set(r.clave, h)
    }
    h.registros.push(r)
  }
  for (const h of mapa.values()) {
    h.registros.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.actualizado - b.actualizado))
    // El nombre que se muestra es el de la anotación más reciente.
    h.nombre = h.registros[h.registros.length - 1].nombre
  }
  return mapa
}

export interface Marca {
  peso: number
  fecha: string
}

/** Mayor peso anotado antes de una fecha (excluida). */
export function recordAntesDe(registros: Registro[], fecha: string): Marca | null {
  let mejor: Marca | null = null
  for (const r of registros) {
    if (r.fecha >= fecha) continue
    const max = pesoMaximo(r.pesos)
    if (max != null && (!mejor || max > mejor.peso)) mejor = { peso: max, fecha: r.fecha }
  }
  return mejor
}

/**
 * Última sesión con algún peso antes de una fecha (excluida). Si ese día hay dos
 * ejercicios con el mismo nombre, prefiere el registro de `ejercicioId`.
 */
export function anteriorA(registros: Registro[], fecha: string, ejercicioId?: string): Registro | null {
  let ultimo: Registro | null = null
  for (const r of registros) {
    if (r.fecha >= fecha || pesoMaximo(r.pesos) == null) continue
    if (!ultimo || r.fecha > ultimo.fecha || (r.fecha === ultimo.fecha && r.ejercicioId === ejercicioId && ultimo.ejercicioId !== ejercicioId)) {
      ultimo = r
    }
  }
  return ultimo
}

/** Última nota escrita antes de una fecha, aunque ese día no se hayan anotado pesos. */
export function notaAnteriorA(registros: Registro[], fecha: string): Registro | null {
  let ultima: Registro | null = null
  for (const r of registros) if (r.fecha < fecha && r.nota.trim() && (!ultima || r.fecha >= ultima.fecha)) ultima = r
  return ultima
}

/** Ejercicios del día con todas sus series anotadas en `registros` (los de una fecha). */
export function contarCompletos(dia: Dia, registros: Registro[]): number {
  const porEjercicio = new Map(registros.map((r) => [r.ejercicioId, r]))
  return dia.ejercicios.filter((e) => {
    const r = porEjercicio.get(e.id)
    return r && r.pesos.slice(0, e.series).filter((p) => p != null).length >= e.series
  }).length
}
