export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // randomUUID solo existe en contexto seguro; en http por la red local no está.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Nombre normalizado para unir el mismo ejercicio entre rutinas distintas. */
export function claveEjercicio(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ---------- Fechas (siempre en la hora local del teléfono) ----------

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

export function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

export function hoy(): string {
  return fechaISO(new Date())
}

export function esFechaISO(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [a, m, d] = s.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d
}

function aDate(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** "30/09" en el año actual, "30/09/25" en otros. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return Number(a) === new Date().getFullYear() ? `${d}/${m}` : `${d}/${m}/${a.slice(2)}`
}

export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function diaSemana(iso: string): string {
  return DIAS_SEMANA[aDate(iso).getDay()]
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aDate(hasta).getTime() - aDate(desde).getTime()) / 86_400_000)
}

export function haceCuanto(iso: string): string {
  const n = diasEntre(iso, hoy())
  if (n <= 0) return 'hoy'
  if (n === 1) return 'ayer'
  if (n < 14) return `hace ${n} días`
  if (n < 60) return `hace ${Math.floor(n / 7)} semanas`
  return `el ${fechaCorta(iso)}`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreMes(iso: string): string {
  const f = aDate(iso)
  return `${MESES[f.getMonth()]} ${f.getFullYear()}`
}

// ---------- Pesos ----------

const fmtKg = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

export function formatoKg(n: number): string {
  return fmtKg.format(n)
}

/** Acepta "42,5", "42.5", "42,5 kg". Vacío = null. Inválido = undefined. */
export function leerPeso(texto: string): number | null | undefined {
  const t = texto.trim().toLowerCase().replace(/kg$/, '').trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d{1,4}(\.\d{0,3})?$/.test(t)) return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n < 2000 ? n : undefined
}

/** Para mostrar en un input: 42.5 -> "42,5". */
export function pesoATexto(n: number | null | undefined): string {
  return n == null ? '' : String(n).replace('.', ',')
}

export function pesoMaximo(pesos: (number | null)[]): number | null {
  let max: number | null = null
  for (const p of pesos) if (p != null && (max == null || p > max)) max = p
  return max
}

export function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  )
}

/** Nombre corto para un botón: el primer nombre, con la inicial del apellido si se repite. */
export function nombresCortos(nombres: { id: string; nombre: string }[]): Map<string, string> {
  const primero = (n: string) => n.trim().split(/\s+/)[0] ?? n
  const cuenta = new Map<string, number>()
  for (const { nombre } of nombres) cuenta.set(primero(nombre).toLowerCase(), (cuenta.get(primero(nombre).toLowerCase()) ?? 0) + 1)
  return new Map(
    nombres.map(({ id, nombre }) => {
      const p = primero(nombre)
      const apellido = nombre.trim().split(/\s+/)[1]
      return [id, (cuenta.get(p.toLowerCase()) ?? 0) > 1 && apellido ? `${p} ${apellido[0].toUpperCase()}.` : p]
    }),
  )
}

export function compararNombres(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}
