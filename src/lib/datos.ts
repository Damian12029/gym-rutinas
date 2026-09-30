import { db } from './db'
import type { Alumno, Dia, DiaParseado, Ejercicio, Registro, Rutina } from './tipos'
import { claveEjercicio, hoy, uid } from './util'
import { marcarActividad } from './sala'

// Pide al navegador que no borre los datos si el teléfono se queda sin espacio.
let persistenciaPedida = false
export async function pedirPersistencia(forzar = false): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    if (persistenciaPedida && !forzar) return false
    persistenciaPedida = true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

// ---------- Alumnos ----------

export async function crearAlumno(nombre: string): Promise<string> {
  const ahora = Date.now()
  const alumno: Alumno = { id: uid(), nombre: nombre.trim(), notas: '', rutinas: [], creado: ahora, actualizado: ahora }
  await db.alumnos.add(alumno)
  void pedirPersistencia()
  return alumno.id
}

export async function modificarAlumno(id: string, cambio: (a: Alumno) => void): Promise<void> {
  await db.transaction('rw', db.alumnos, async () => {
    const alumno = await db.alumnos.get(id)
    if (!alumno) throw new Error('El alumno ya no existe')
    cambio(alumno)
    alumno.actualizado = Date.now()
    await db.alumnos.put(alumno)
  })
}

export async function borrarAlumno(id: string): Promise<void> {
  await db.transaction('rw', db.alumnos, db.registros, db.sala, async () => {
    await db.registros.where('alumnoId').equals(id).delete()
    await db.sala.delete(id)
    await db.alumnos.delete(id)
  })
}

// ---------- Rutinas ----------

export function diasDesdeTexto(dias: DiaParseado[]): Dia[] {
  return dias.map((d) => ({
    id: uid(),
    nombre: d.nombre,
    ejercicios: d.ejercicios.map((e) => ({ id: uid(), ...e })),
  }))
}

/** Copia días de otra rutina con ids nuevos (lo anotado no se copia). */
export function clonarDias(dias: Dia[]): Dia[] {
  return dias.map((d) => ({
    id: uid(),
    nombre: d.nombre,
    ejercicios: d.ejercicios.map((e) => ({ ...e, id: uid() })),
  }))
}

export function ejercicioVacio(): Ejercicio {
  return { id: uid(), nombre: '', series: 3, reps: '', descanso: '', indicaciones: '' }
}

/** Crea la rutina como activa; las anteriores quedan guardadas sin borrar lo anotado. */
export async function crearRutina(alumnoId: string, nombre: string, dias: Dia[]): Promise<string> {
  const rutina: Rutina = {
    id: uid(),
    nombre: nombre.trim() || 'Rutina',
    creada: hoy(),
    activa: true,
    dias: dias.length ? dias : [{ id: uid(), nombre: 'Día 1', ejercicios: [] }],
  }
  await modificarAlumno(alumnoId, (a) => {
    for (const r of a.rutinas) r.activa = false
    a.rutinas.unshift(rutina)
  })
  return rutina.id
}

export async function modificarRutina(alumnoId: string, rutinaId: string, cambio: (r: Rutina) => void): Promise<void> {
  await modificarAlumno(alumnoId, (a) => {
    const rutina = a.rutinas.find((r) => r.id === rutinaId)
    if (!rutina) throw new Error('La rutina ya no existe')
    cambio(rutina)
  })
}

export async function activarRutina(alumnoId: string, rutinaId: string): Promise<void> {
  await modificarAlumno(alumnoId, (a) => {
    for (const r of a.rutinas) r.activa = r.id === rutinaId
  })
}

export async function borrarRutina(alumnoId: string, rutinaId: string): Promise<void> {
  await modificarAlumno(alumnoId, (a) => {
    a.rutinas = a.rutinas.filter((r) => r.id !== rutinaId)
  })
}

export function mover<T>(lista: T[], indice: number, delta: number): void {
  const destino = indice + delta
  if (indice < 0 || destino < 0 || destino >= lista.length) return
  const [item] = lista.splice(indice, 1)
  lista.splice(destino, 0, item)
}

// ---------- Días ----------

export async function agregarDia(alumnoId: string, rutinaId: string): Promise<string> {
  const id = uid()
  await modificarRutina(alumnoId, rutinaId, (r) => {
    // Siguiente al mayor "Día N" que haya: con la cantidad sola, borrar un día intermedio repetía nombres.
    const mayor = Math.max(r.dias.length, ...r.dias.map((d) => Number(/^d[ií]a\s*(\d+)/i.exec(d.nombre)?.[1] ?? 0)))
    r.dias.push({ id, nombre: `Día ${mayor + 1}`, ejercicios: [] })
  })
  return id
}

export async function modificarDia(alumnoId: string, rutinaId: string, diaId: string, cambio: (d: Dia, r: Rutina) => void): Promise<void> {
  await modificarRutina(alumnoId, rutinaId, (r) => {
    const dia = r.dias.find((d) => d.id === diaId)
    if (!dia) throw new Error('El día ya no existe')
    cambio(dia, r)
  })
}

export async function moverDia(alumnoId: string, rutinaId: string, diaId: string, delta: number): Promise<void> {
  await modificarRutina(alumnoId, rutinaId, (r) => {
    mover(
      r.dias,
      r.dias.findIndex((d) => d.id === diaId),
      delta,
    )
  })
}

export async function borrarDia(alumnoId: string, rutinaId: string, diaId: string): Promise<void> {
  await modificarRutina(alumnoId, rutinaId, (r) => {
    r.dias = r.dias.filter((d) => d.id !== diaId)
  })
}

// ---------- Ejercicios ----------

/**
 * Alta o edición. Si cambia el nombre de un ejercicio con historial:
 * - corrección (`esOtro` false): lo anotado pasa al nombre nuevo;
 * - reemplazo (`esOtro` true): entra un ejercicio nuevo en el mismo lugar y lo anotado
 *   queda con el nombre viejo, para que el progreso de uno no se mezcle con el del otro.
 */
export async function guardarEjercicio(
  alumnoId: string,
  rutinaId: string,
  diaId: string,
  ejercicio: Ejercicio,
  { esOtro = false }: { esOtro?: boolean } = {},
): Promise<void> {
  const limpio: Ejercicio = {
    ...ejercicio,
    id: esOtro ? uid() : ejercicio.id,
    nombre: ejercicio.nombre.trim(),
    reps: ejercicio.reps.trim(),
    descanso: ejercicio.descanso.trim(),
    indicaciones: ejercicio.indicaciones.trim(),
    series: Math.min(10, Math.max(1, Math.round(ejercicio.series) || 1)),
  }
  await db.transaction('rw', db.alumnos, db.registros, async () => {
    await modificarDia(alumnoId, rutinaId, diaId, (d) => {
      const i = d.ejercicios.findIndex((e) => e.id === ejercicio.id)
      if (i >= 0) d.ejercicios[i] = limpio
      else d.ejercicios.push(limpio)
    })
    if (esOtro) return
    const clave = claveEjercicio(limpio.nombre)
    const ahora = Date.now()
    // `actualizado` nuevo solo en lo que cambia: restaurar una copia decide por esa fecha.
    await db.registros
      .where('ejercicioId')
      .equals(limpio.id)
      .modify((r) => {
        if (r.clave === clave && r.nombre === limpio.nombre) return
        r.clave = clave
        r.nombre = limpio.nombre
        r.actualizado = ahora
      })
  })
}

export async function moverEjercicio(alumnoId: string, rutinaId: string, diaId: string, ejercicioId: string, delta: number): Promise<void> {
  await modificarDia(alumnoId, rutinaId, diaId, (d) => {
    mover(
      d.ejercicios,
      d.ejercicios.findIndex((e) => e.id === ejercicioId),
      delta,
    )
  })
}

export async function borrarEjercicio(alumnoId: string, rutinaId: string, diaId: string, ejercicioId: string): Promise<void> {
  await modificarDia(alumnoId, rutinaId, diaId, (d) => {
    d.ejercicios = d.ejercicios.filter((e) => e.id !== ejercicioId)
  })
}

// ---------- Lo anotado ----------

/** Un registro por ejercicio y fecha. Si queda sin pesos ni nota, se borra. */
export async function guardarRegistro(p: { alumnoId: string; ejercicio: Ejercicio; fecha: string; pesos: (number | null)[]; nota: string }): Promise<void> {
  const pesos = [...p.pesos]
  // Las series extra vacías al final no suman nada.
  while (pesos.length > p.ejercicio.series && pesos[pesos.length - 1] == null) pesos.pop()
  const vacio = pesos.every((x) => x == null) && !p.nota.trim()

  await db.transaction('rw', db.registros, async () => {
    const existente = await db.registros.where('[ejercicioId+fecha]').equals([p.ejercicio.id, p.fecha]).first()
    if (vacio) {
      if (existente) await db.registros.delete(existente.id)
      return
    }
    const registro: Registro = {
      id: existente?.id ?? uid(),
      alumnoId: p.alumnoId,
      ejercicioId: p.ejercicio.id,
      clave: claveEjercicio(p.ejercicio.nombre),
      nombre: p.ejercicio.nombre,
      fecha: p.fecha,
      pesos,
      nota: p.nota,
      actualizado: Date.now(),
    }
    await db.registros.put(registro)
  })
  void pedirPersistencia()
  void marcarActividad(p.alumnoId)
}
