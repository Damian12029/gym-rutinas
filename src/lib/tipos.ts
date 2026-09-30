export interface Ejercicio {
  id: string
  nombre: string
  /** Series efectivas que se anotan (no cuenta el calentamiento). */
  series: number
  /** Repeticiones tal cual las escribe el entrenador: "12", "8 a 6", "12-10-8". */
  reps: string
  /** "1:30 min", "1:30 a 2 min". */
  descanso: string
  /** Texto libre: calentamiento, aproximación, técnica, biserie. */
  indicaciones: string
}

export interface Dia {
  id: string
  nombre: string
  ejercicios: Ejercicio[]
}

export interface Rutina {
  id: string
  nombre: string
  /** YYYY-MM-DD */
  creada: string
  activa: boolean
  dias: Dia[]
}

export interface Alumno {
  id: string
  nombre: string
  notas: string
  rutinas: Rutina[]
  creado: number
  actualizado: number
}

/** Lo anotado de un ejercicio en una fecha. Uno por (ejercicioId, fecha). */
export interface Registro {
  id: string
  alumnoId: string
  ejercicioId: string
  /** Nombre normalizado: une el progreso del mismo ejercicio entre rutinas. */
  clave: string
  nombre: string
  /** YYYY-MM-DD */
  fecha: string
  /** Kg por serie; null = serie sin anotar. */
  pesos: (number | null)[]
  nota: string
  actualizado: number
}

// Salida del lector de texto pegado (sin ids).
export interface EjercicioParseado {
  nombre: string
  series: number
  reps: string
  descanso: string
  indicaciones: string
}

export interface DiaParseado {
  nombre: string
  ejercicios: EjercicioParseado[]
}

export interface RutinaParseada {
  /** Primera línea suelta antes del primer día (ej. "Rutina hipertrofia"), o "". */
  titulo: string
  dias: DiaParseado[]
}
