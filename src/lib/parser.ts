import type { DiaParseado, EjercicioParseado, RutinaParseada } from './tipos'

// Lector de rutinas pegadas desde WhatsApp o notas del celular. Criterio: acertar
// en los casos comunes y no perder texto; lo que no se entiende va a "indicaciones".

const SERIES_DEFECTO = 3
const SERIES_MAX = 10
const TITULO_MAX = 60
const ENCABEZADO_MAX = 60
// Reemplaza los tramos ya interpretados (patrón, descanso) sin correr los índices.
const MARCA = '\u0001'

// ---------------------------------------------------------------- "no precedido por"

/** Carácter anterior a la posición `i`, entero aunque sea un par sustituto (emoji). */
function caracterAntes(s: string, i: number): string {
  const c = s.charCodeAt(i - 1)
  return c >= 0xdc00 && c <= 0xdfff && i >= 2 ? s.slice(i - 2, i) : s.charAt(i - 1)
}

/**
 * Safari anterior a 16.4 no entiende el lookbehind negativo: una sola expresión con
 * eso deja la app entera en blanco. Esta clase lo emula para el único uso del lector,
 * un "no precedido por" al principio del patrón: descarta la coincidencia si el carácter
 * anterior es de la clase `previo` y sigue buscando desde la posición siguiente, igual
 * que el motor. test, match, matchAll, replace y split pasan todos por exec.
 */
export class RegexSinPrevio extends RegExp {
  readonly previo: RegExp
  private busquedaGlobal: RegexSinPrevio | null = null

  // matchAll y split crean una copia con `new (this.constructor)(regex, flags)`.
  constructor(patron: string | RegExp, flags?: string, previo?: RegExp) {
    super(patron, flags)
    const heredado = patron instanceof RegexSinPrevio ? patron.previo : undefined
    const clase = previo ?? heredado
    if (!clase) throw new Error('RegexSinPrevio sin la clase de carácter previa')
    this.previo = clase
  }

  exec(texto: string): RegExpExecArray | null {
    const s = String(texto)
    if (!this.global && !this.sticky) {
      // Sin "g" el motor siempre arranca de 0: para poder seguir después de un
      // descarte se busca con una copia global.
      this.busquedaGlobal ??= new RegexSinPrevio(this.source, `${this.flags}g`, this.previo)
      this.busquedaGlobal.lastIndex = 0
      return this.busquedaGlobal.exec(s)
    }
    for (;;) {
      const m = super.exec(s)
      if (!m) return null
      if (m.index === 0 || !this.previo.test(caracterAntes(s, m.index))) return m
      if (this.sticky) {
        this.lastIndex = 0
        return null
      }
      this.lastIndex = m.index + ((s.codePointAt(m.index) ?? 0) > 0xffff ? 2 : 1)
    }
  }
}

function sinPrevio(previo: RegExp, patron: string, flags: string): RegExp {
  return new RegexSinPrevio(patron, flags, previo)
}

const PREVIO_LETRA = /\p{L}/u
const PREVIO_ALFANUM = /[\p{L}\p{N}]/u
const PREVIO_NUM = /[\p{N}.,:/]/u

interface Tramo {
  inicio: number
  fin: number
}

interface Patron extends Tramo {
  /** null cuando solo dice "12 rtc": las series quedan por defecto. */
  series: number | null
  reps: string
  prioridad: number
  calentamiento: boolean
}

interface Descanso extends Tramo {
  texto: string
}

interface Nombre {
  /** Incluye el conector ("y", "+") que lo une al ejercicio anterior. */
  spanInicio: number
  fin: number
  texto: string
}

interface Grupo {
  nombre: string
  patron: Patron | null
  indicaciones: string
}

interface Analisis {
  descanso: string
  empiezaConDescanso: boolean
  /** Texto que sigue al descanso en la misma línea ("y 2 min entre ejercicios"). */
  colaDescanso: string
  hayPatrones: boolean
  /** Vacío cuando la línea no tiene nada que parezca nombre de ejercicio. */
  grupos: Grupo[]
  patronSuelto: Patron | null
  /** Línea sin el primer patrón efectivo ni el descanso. */
  resto: string
  restoSinDescanso: string
  lineaLimpia: string
}

interface EjercicioInterno extends EjercicioParseado {
  sinPatron: boolean
}

interface DiaInterno {
  nombre: string
  implicito: boolean
  descansoGeneral: string
  /** Indicación que llegó antes del primer ejercicio: se le suma a ese ejercicio. */
  nota: string
  ejercicios: EjercicioInterno[]
}

// ---------------------------------------------------------------- expresiones

const NUM_REPS = String.raw`\d{1,3}(?!\d)`
const SIN_SERIES = String.raw`(?!\s*(?:series?|sets?)(?!\p{L}))`
const SIN_OTRO_PATRON = String.raw`(?!\s*[x×]\s*\d)${SIN_SERIES}`
// Tras una coma o un " - " el número puede ser un peso o un tiempo, no otra repetición.
const SIN_UNIDAD = String.raw`(?!\s*(?:kg|kilos?|lbs?|%|seg|segundos|s|min|minutos|m|"|'|”|’)(?!\p{L}))`
const ITEM_REPS = String.raw`(?:\s*(?:a|o)\s*${NUM_REPS}|(?:[-–/]\s?|\s[-–/](?!\s))${NUM_REPS}|\s[-–/]\s${NUM_REPS}${SIN_UNIDAD}|\s*,\s*${NUM_REPS}${SIN_UNIDAD}|\s+y\s+${NUM_REPS}${SIN_UNIDAD})${SIN_OTRO_PATRON}`
// Tras el primer número sí puede seguir "x 60kg": es el peso ("4 x 10 x 60kg"), no otro patrón.
const VALOR_REPS = String.raw`(?:${NUM_REPS}${SIN_SERIES}(?:${ITEM_REPS})*|(?:al\s+|hasta\s+el\s+)?fallo(?!\p{L})|m[aá]x(?:imo|imos|imas?)?(?!\p{L}))`
const PALABRA_REPS = String.raw`(?:rtc|rct|reps?|repeticiones|repes)(?!\p{L})`
const SUFIJO_REPS = String.raw`(?:\s*${PALABRA_REPS})?`
const UNIDAD_REPS = String.raw`(?:\s*(segundos|segs|seg|s|"|”|''|minutos|min|metros|mts|m)(?!\p{L}))?`
const LADO_REPS = String.raw`(?:\s*(?:c\s?\/\s?|p\/\s?|cada\s+|por\s+|x\s*)(pierna|lado|brazo|mano|u)s?(?!\p{L}))?`
// La "x" que separa las reps del peso queda dentro del patrón; el peso va a indicaciones.
const ANTES_DEL_PESO = String.raw`(?:\s*[x×](?=\s*\d))?`

const RE_X = sinPrevio(
  PREVIO_NUM,
  String.raw`(\d{1,2})\s*[x×]\s*(${VALOR_REPS})${SUFIJO_REPS}${UNIDAD_REPS}${LADO_REPS}${ANTES_DEL_PESO}`,
  'giu',
)
const RE_REPS_X = sinPrevio(
  PREVIO_NUM,
  String.raw`(${NUM_REPS}(?:${ITEM_REPS})*)\s*${PALABRA_REPS}${LADO_REPS}\s*[x×]\s*(\d{1,2})(?!\d)(?:\s*(?:series?|sets?)(?!\p{L}))?`,
  'giu',
)
const RE_SERIES = sinPrevio(
  PREVIO_NUM,
  String.raw`(\d{1,2})\s*(?:series?|sets?)(?!\p{L})\s*(?:(?:de|x|×|por)\s*)?(${VALOR_REPS})${SUFIJO_REPS}${UNIDAD_REPS}${LADO_REPS}${ANTES_DEL_PESO}`,
  'giu',
)
const RE_SERIES_SOLAS = sinPrevio(PREVIO_NUM, String.raw`(\d{1,2})\s*(?:series?|sets?)(?!\p{L})`, 'giu')
const RE_SOLO_REPS = sinPrevio(
  PREVIO_NUM,
  String.raw`(${NUM_REPS}(?:${ITEM_REPS})*)\s*${PALABRA_REPS}${LADO_REPS}`,
  'giu',
)
// Lo que puede separar "4 series" de "10 reps" para leerlos como un solo patrón.
const RE_SEPARADOR_PATRON = /^\s*(?:[-–—:,/x×]|de)?\s*$/iu

const COMPUESTO_T = String.raw`\d{1,2}\s*(?:minutos?|mins?|m|')\s*(?:y\s+)?\d{1,2}\s*(?:segundos|segs?|s|''|")(?!\p{L})`
const NUM_T = String.raw`(?:${COMPUESTO_T}|\d{1,3}(?:\s?:\s?\d{2}|\.\d{2}|,\d{1,2}|'\d{2}(?:''|"|”)?)?)`
// Un número seguido de "x 8" o de "series" es un patrón ("con pausa 3 x 8"), no un descanso.
const TRAS_NUM_T = String.raw`(?!\d)(?!\s*[x×]\s*\d)(?!\s*(?:(?:series?|sets?)(?!\p{L})|${PALABRA_REPS}))`
const UNIDAD_T = String.raw`(?:minutos|minuto|mins|min|m|segundos|segs|seg|s|''|"|”|'|’)(?!\p{L})`
const RANGO_T = String.raw`(${NUM_T})${TRAS_NUM_T}(?:\s*(${UNIDAD_T}))?(?:\s*(a|o|-|–|\/)\s*(${NUM_T})${TRAS_NUM_T}(?:\s*(${UNIDAD_T}))?)?`
const ENTRE = String.raw`entre\s+(?:series|serie|ejercicios|ejercicio|vueltas|rondas|sets|bloques)`
const RE_DESCANSO = sinPrevio(
  PREVIO_LETRA,
  String.raw`(?:c\/\s?|con\s+)?(?:descansos?|descansar|pausas?|recuperaci[oó]n|desc\.?)(?!\p{L})\s*(?:(${ENTRE})\s*)?[:=]?\s*(?:de\s+)?${RANGO_T}(?:\s+(${ENTRE}))?`,
  'giu',
)
const RE_DESCANSO_DESPUES = sinPrevio(
  PREVIO_NUM,
  String.raw`${RANGO_T}\s*(?:de\s+)?(?:descanso|pausa)(?!\p{L})(?:\s+(${ENTRE}))?`,
  'giu',
)
// Menos de 10 segundos no es descanso entre series sino una pausa de técnica ("pausa 2 seg abajo").
const PAUSA_TECNICA_MAX_SEG = 10
const SEG_T = String.raw`\d{1,2}\s*(?:segundos|segs?|s|''|")(?!\p{L})`

// Palabras de técnica o prescripción: cortan el nombre del ejercicio.
const RE_TECNICA = sinPrevio(
  PREVIO_ALFANUM,
  String.raw`(?:una serie|un set|series? de calentamiento|calentamiento|entrada en calor|aproximaci[oó]n(?:es)?|carga progresiva|peso m[aá]ximo|m[aá]ximo peso|(?:bi|tri|super)[\s-]?series?|drop[\s-]?sets?|al fallo|hasta el fallo|rest[\s-]?pause|pir[aá]mide|piramidal|(?:con\s+)?pausas?\s+(?:de\s+)?${SEG_T}|(?:con\s+)?${SEG_T}\s*(?:de\s+)?pausa)(?!\p{L})`,
  'giu',
)
const RE_CALENTAMIENTO = sinPrevio(PREVIO_LETRA, String.raw`(?:calentamiento|aproximaci[oó]n(?:es)?|entrada en calor)(?!\p{L})`, 'giu')
// "1x15 (calentamiento)" marca al patrón anterior; "3x10 (aproximación 1x15)" no, porque trae el suyo.
const RE_CALENTAMIENTO_DESPUES =
  /^\s*(?:[([]\s*(?:de\s+)?(?:calentamiento|aproximaci[oó]n|entrada en calor)[^\d)\]]*[)\]]|(?:de\s+)?(?:calentamiento|aproximaci[oó]n|entrada en calor))/iu
const RE_CONECTOR =
  /^(?:(?:y|e|luego|despu[eé]s|m[aá]s)(?!\p{L})\s*|[+&]\s*)?(?:(?:bi|tri|super)[\s-]?series?(?!\p{L})\s*(?:con\s+)?)?/iu
// Entre dos ejercicios de la misma línea también unen "con" y "/" ("biserie 3x12 con cruce 3x12").
const RE_CONECTOR_ENTRE =
  /^(?:(?:y|e|luego|despu[eé]s|m[aá]s|con)(?!\p{L})\s*|[+&/]\s*)?(?:(?:bi|tri|super)[\s-]?series?(?!\p{L})\s*(?:con\s+)?)?/iu
const RE_TIPO_SERIE = sinPrevio(PREVIO_LETRA, String.raw`(bi|tri|super)[\s-]?series?(?!\p{L})`, 'iu')
const RE_TIPO_SERIE_G = sinPrevio(PREVIO_LETRA, String.raw`(?:bi|tri|super)[\s-]?series?(?!\p{L})\s*:?`, 'giu')
// Rótulos de bloque que preceden al ejercicio: "Abdominales: crunch 3x20", "Triserie hombros: ...".
const RE_ROTULO_BLOQUE = sinPrevio(
  PREVIO_LETRA,
  String.raw`(?:cardio|circuito|bloque|core|movilidad|elongaci[oó]n|estiramientos?|finisher|zona media|y|e|de|con|para)(?!\p{L})`,
  'giu',
)

const RE_DIA =
  /^(d[ií]as?)(?:\s*(\d{1,2}(?:\s*(?:,|y|e)\s*\d{1,2})*)|\s+([a-z]|uno|dos|tres|cuatro|cinco|seis|siete))(?![\p{L}\p{N}])/iu
const RE_D = /^d(\d{1,2})(?![\p{L}\p{N}])/iu
const RE_ORDINAL = /^(?:primer|segundo|tercer|cuarto|quinto|sexto|s[eé]ptimo)\s+d[ií]a(?!\p{L})/iu
const RE_ORDINAL_NUM = /^(\d{1,2})\s?(?:°|º|ª|er|ro|do|to|mo|vo|no)\.?\s*d[ií]a(?!\p{L})/iu
const RE_SEMANA = /^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?!\p{L})/iu
const RE_RUTINA =
  /^(rutina|entrenamiento|entreno|sesi[oó]n|semana|bloque|fase|mesociclo|microciclo|etapa)\s+(\d{1,2}|[a-z])(?![\p{L}\p{N}])/iu
// "Semana 1 - Día 2": la sección antecede al día en la misma línea.
const RE_SECCION_DIA =
  /^(rutina|semana|bloque|fase|mesociclo|microciclo|etapa)\s+(\d{1,2}|[a-z])(?![\p{L}\p{N}])\s*[-–—:,|/.]?\s*/iu
const RE_DIA_DE = /^d[ií]as?\s+de\s+\p{L}/iu

const RE_TITULO =
  /^(?:rutina|plan|programa|planificaci[oó]n|entrenamiento|mesociclo|microciclo|macrociclo|bloque|fase|semana|alumn[oa]|nombre|objetivo)(?!\p{L})/iu
// Si una línea suelta nombra un ejercicio, no es el título. Palabra completa (con plural):
// "barra" no tiene que encontrarse en "Barraza".
const RE_VOCABULARIO = sinPrevio(
  PREVIO_LETRA,
  String.raw`(?:press|curl|remo|sentadilla|squat|prensa|estocada|zancada|b[uú]lgara|extensi[oó]n|flexi[oó]n|vuelo|elevaci[oó]n|dominada|fondo|abdominal|crunch|plancha|peso muerto|hip thrust|puente|gemelo|pantorrilla|jal[oó]n|dorsalera|polea|mancuerna|barra|m[aá]quina|banco|bici(?:cleta)?|cinta|caminata|trote|burpee|salto|soga|apertura|cruce|pullover|face pull|p[aá]jaro|encogimiento|femoral|cu[aá]driceps|aductor|abductor|gl[uú]teo|patada|tr[ií]ceps|b[ií]ceps|militar|kettlebell|swing|step|el[ií]ptico|remadora|escalador|lagartija|thruster|hiperextensi[oó]n|lumbar|isquio(?:tibial)?|serrucho|martillo|predicador|smith|hack|mariposa|rueda)(?:e?s)?(?!\p{L})`,
  'iu',
)
// Primera palabra tras un número que indica que el número es parte de la prescripción, no una viñeta.
const RE_NO_VINETA =
  /^(?:x|series?|sets?|rtc|rct|reps?|repeticiones|repes|segundos|segs?|s|minutos?|mins?|m|metros|mts|km|kg|kilos?|vueltas|rondas|veces|de|a|o|y|al)(?!\p{L})/iu

const RE_GRUPO_MUSCULAR = sinPrevio(
  PREVIO_LETRA,
  String.raw`(?:tren superior|tren inferior|full body|cuerpo completo|pectorales?|pecho|espalda|dorsales?|hombros?|deltoides|b[ií]ceps|tr[ií]ceps|brazos?|piernas?|cu[aá]driceps|femorales?|isquiotibiales|isquios?|gl[uú]teos?|gemelos|pantorrillas|abdominales|abdomen|abs|core|trapecios?|antebrazos?|lumbares?|aductores|abductores|torso|empuje|tracci[oó]n|tir[oó]n|push|pull|legs)(?!\p{L})`,
  'giu',
)
// Un solo grupo alcanza como subtítulo si no se confunde con un ejercicio ("Abdominales").
const RE_CONECTOR_SUBTITULO = sinPrevio(PREVIO_LETRA, String.raw`(?:y|e|con)(?!\p{L})`, 'giu')
const RE_CURSIVA = sinPrevio(PREVIO_ALFANUM, String.raw`_([^_]+)_(?![\p{L}\p{N}])`, 'gu')
const RE_GRUPO_FUERTE =
  /^(?:tren superior|tren inferior|full body|cuerpo completo|pecho|espalda|hombros|piernas?|brazos|gl[uú]teos|torso|empuje|tracci[oó]n|tir[oó]n|push|pull|legs)$/iu

// ---------------------------------------------------------------- utilidades de texto

function capitalizar(t: string): string {
  return t ? t.charAt(0).toLocaleUpperCase('es') + t.slice(1) : t
}

function minusculaInicial(t: string): string {
  return t ? t.charAt(0).toLocaleLowerCase('es') + t.slice(1) : t
}

function quitarParentesisSueltos(t: string): string {
  const quitar = new Set<number>()
  const abiertos: number[] = []
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') abiertos.push(i)
    else if (t[i] === ')') {
      if (abiertos.length > 0) abiertos.pop()
      else quitar.add(i)
    }
  }
  for (const i of abiertos) quitar.add(i)
  if (quitar.size === 0) return t
  return t
    .split('')
    .filter((_, i) => !quitar.has(i))
    .join('')
}

/** Saca puntuación colgando y dobles espacios; primera letra mayúscula. */
function limpiarTexto(t: string): string {
  let r = t.replaceAll(MARCA, ' ').replace(/\s+/g, ' ')
  r = quitarParentesisSueltos(r)
  r = r.replace(/\(\s*\)/g, ' ')
  r = r.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
  r = r.replace(/\s+([,.;:])/g, '$1')
  r = r.replace(/([,.;:])(?:\s*[,.;:])+/g, '$1')
  r = r.replace(/\s+/g, ' ')
  r = r.replace(/^[\s,.;:\-–—+&]+/u, '').replace(/[\s,.;:\-–—+&]+$/u, '')
  r = r.replace(/^(?:y|e)\s+(?=\S)/iu, '')
  return capitalizar(r)
}

function unir(a: string, b: string): string {
  if (!a) return b
  if (!b) return a
  return `${a}. ${capitalizar(b)}`
}

function normalizarLinea(cruda: string): string {
  let l = cruda.replace(/[   \t]/g, ' ')
  // Número con emoji de tecla ("1️⃣ Press") pasa a viñeta "1)".
  l = l.replace(/(\d)️?⃣/gu, '$1)')
  l = l.replace(/[\p{Extended_Pictographic}️]/gu, ' ')
  l = l.replace(/[×✕✖]/g, 'x')
  // Negrita, cursiva y tachado de WhatsApp.
  l = l.replace(/\*([^*]+)\*/g, '$1')
  l = l.replace(RE_CURSIVA, '$1')
  l = l.replace(/~([^~]+)~/g, '$1')
  // Minutos y segundos con el apóstrofo del iPhone (’) o el acento de Android (´): 1’30”, 2´, 30’’.
  l = l.replace(/(\d)\s?[’´′‘`]\s?[’´′‘`]/g, "$1''")
  l = l.replace(/(\d)\s?[’´′‘`]/g, "$1'")
  l = l.replace(/(\d)\s?[”“″]/g, '$1"')
  l = l.replace(/\s+/g, ' ').trim()
  l = l.replace(/^[^\p{L}\p{N}(¿¡]+/u, '')
  l = l.replace(/^(?:\d{1,2}\s*[.)-]|[a-z][.)]|ej(?:ercicio)?\.?\s*\d{1,2}\s*[:.)\-–]?)\s*(?=\p{L})/iu, '')
  // "1 Press plano 4x10": número de orden sin puntuación. Solo si el resto trae series y reps;
  // si no, el número puede ser la cantidad ("20 abdominales 3 series").
  const numero = /^\d{1,2}\s+(?=\p{L})/u.exec(l)
  if (numero) {
    const resto = l.slice(numero[0].length)
    if (!RE_NO_VINETA.test(resto) && tienePatronCompleto(resto)) l = resto
  }
  return l.trim()
}

function enmascarar(s: string, tramos: Tramo[]): string {
  let r = s
  for (const t of tramos) r = r.slice(0, t.inicio) + MARCA.repeat(t.fin - t.inicio) + r.slice(t.fin)
  return r
}

/** Texto de s entre inicio y fin, salteando los tramos indicados. */
function textoSin(s: string, inicio: number, fin: number, quitar: Tramo[]): string {
  const tramos = quitar.filter((t) => t.fin > inicio && t.inicio < fin).sort((a, b) => a.inicio - b.inicio)
  let out = ''
  let i = inicio
  for (const t of tramos) {
    if (t.inicio > i) out += s.slice(i, t.inicio)
    out += ' '
    i = Math.max(i, t.fin)
  }
  if (i < fin) out += s.slice(i, fin)
  return out
}

// ---------------------------------------------------------------- descanso

function numeroDescanso(n: string): string {
  return n
    .replace(/\s/g, '')
    .replace(/^(\d+)[.,](\d{2})$/, '$1:$2')
    .replace(/^(\d+)'(\d{2})(?:''|"|”)?$/, '$1:$2')
    .replace(
      /^(\d+)(?:minutos?|mins?|m|')(?:y)?(\d{1,2})(?:segundos|segs?|s|''|")$/i,
      (_, min: string, seg: string) => `${min}:${seg.padStart(2, '0')}`,
    )
}

function unidadDescanso(u: string | undefined): string {
  if (!u) return ''
  return /^(?:m|min|mins|minuto|minutos|'|’)$/i.test(u) ? 'min' : 'seg'
}

function unidadPorDefecto(n: string): string {
  if (n.includes(':')) return 'min'
  return Number.parseFloat(n.replace(',', '.')) <= 5 ? 'min' : 'seg'
}

function formatearDescanso(
  n1: string,
  u1: string | undefined,
  sep: string | undefined,
  n2: string | undefined,
  u2: string | undefined,
  entre: string | undefined,
): string {
  const a = numeroDescanso(n1)
  const ua = unidadDescanso(u1)
  let texto = ua ? `${a} ${ua}` : a
  if (n2) {
    const b = numeroDescanso(n2)
    const ub = unidadDescanso(u2)
    texto += ` ${sep?.toLowerCase() === 'o' ? 'o' : 'a'} ${b}`
    if (ub) texto += ` ${ub}`
    else if (!ua) texto += ` ${unidadPorDefecto(b)}`
  } else if (!ua) {
    texto += ` ${unidadPorDefecto(a)}`
  }
  if (entre) texto += ` ${entre.toLowerCase().replace(/\s+/g, ' ')}`
  return texto
}

function esPausaTecnica(texto: string): boolean {
  const m = /^(\d+(?:,\d+)?)(?: (?:a|o) (\d+(?:,\d+)?))? seg(?: |$)/.exec(texto)
  if (!m) return false
  return [m[1], m[2]].every((n) => n === undefined || Number.parseFloat(n.replace(',', '.')) < PAUSA_TECNICA_MAX_SEG)
}

function buscarDescanso(s: string): Descanso | null {
  for (const m of s.matchAll(RE_DESCANSO)) {
    const texto = formatearDescanso(m[2], m[3], m[4], m[5], m[6], m[1] ?? m[7])
    if (!esPausaTecnica(texto)) return { inicio: m.index, fin: m.index + m[0].length, texto }
  }
  for (const d of s.matchAll(RE_DESCANSO_DESPUES)) {
    const texto = formatearDescanso(d[1], d[2], d[3], d[4], d[5], d[6])
    if (!esPausaTecnica(texto)) return { inicio: d.index, fin: d.index + d[0].length, texto }
  }
  return null
}

// ---------------------------------------------------------------- series x reps

function formatearReps(valor: string, unidad?: string, lado?: string): string {
  let r = valor.toLowerCase().replace(/\s+/g, ' ').trim()
  if (r.includes('fallo')) r = 'al fallo'
  else if (/^m[aá]x/.test(r)) r = 'máx'
  else r = r.replace(/\s+y\s+/g, '-').replace(/\s*[-–/,]\s*/g, '-').replace(/\s*(a|o)\s*/g, ' $1 ')
  if (unidad) {
    const u = unidad.toLowerCase()
    if (/^(?:minutos|min)$/.test(u)) r += ' min'
    else if (/^(?:metros|mts|m)$/.test(u)) r += ' m'
    else r += ' seg'
  }
  if (lado) r += ` c/${lado.toLowerCase()}`
  return r
}

function seriesValidas(n: string): number | null {
  const v = Number.parseInt(n, 10)
  return v >= 1 && v <= SERIES_MAX ? v : null
}

function buscarPatrones(t: string): Patron[] {
  const candidatos: Patron[] = []
  const agregar = (
    re: RegExp,
    prioridad: number,
    armar: (m: RegExpExecArray) => { series: number | null; reps: string } | null,
  ) => {
    for (const m of t.matchAll(re)) {
      const r = armar(m)
      if (!r) continue
      candidatos.push({ inicio: m.index, fin: m.index + m[0].length, prioridad, calentamiento: false, ...r })
    }
  }
  const conSeries = (n: string, reps: string) => {
    const series = seriesValidas(n)
    return series === null ? null : { series, reps }
  }
  agregar(RE_X, 0, (m) => conSeries(m[1], formatearReps(m[2], m[3], m[4])))
  agregar(RE_REPS_X, 1, (m) => conSeries(m[3], formatearReps(m[1], undefined, m[2])))
  agregar(RE_SERIES, 2, (m) => conSeries(m[1], formatearReps(m[2], m[3], m[4])))
  agregar(RE_SERIES_SOLAS, 3, (m) => conSeries(m[1], ''))
  agregar(RE_SOLO_REPS, 4, (m) => ({ series: null, reps: formatearReps(m[1], undefined, m[2]) }))

  candidatos.sort((a, b) => a.inicio - b.inicio || a.prioridad - b.prioridad || b.fin - a.fin)
  const elegidos: Patron[] = []
  for (const c of candidatos) {
    const ultimo = elegidos.at(-1)
    if (ultimo && c.inicio < ultimo.fin) continue
    elegidos.push(c)
  }
  return elegidos
}

/** Un patrón es de calentamiento si lo anuncia la frase inmediata anterior o posterior. */
function marcarCalentamiento(s: string, patrones: Patron[]): void {
  let desde = 0
  for (const p of patrones) {
    const clausula = s.slice(desde, p.inicio).split(/[.;,]/).at(-1) ?? ''
    const ultimo = [...clausula.matchAll(RE_CALENTAMIENTO)].at(-1)
    const porAntes = ultimo !== undefined && /^[\s:]*(?:de\s*)?$/iu.test(clausula.slice(ultimo.index + ultimo[0].length))
    p.calentamiento = porAntes || RE_CALENTAMIENTO_DESPUES.test(s.slice(p.fin))
    desde = p.fin
  }
}

/** "4 series - 10 reps" o "10 reps, 4 series": las series y las reps sueltas y contiguas son un patrón. */
function fusionarPatrones(s: string, patrones: Patron[]): Patron[] {
  const soloSeries = (p: Patron) => p.series !== null && !p.reps
  const soloReps = (p: Patron) => p.series === null && p.reps !== ''
  const out: Patron[] = []
  for (const p of patrones) {
    const prev = out.at(-1)
    if (prev && !prev.calentamiento && !p.calentamiento && RE_SEPARADOR_PATRON.test(s.slice(prev.fin, p.inicio))) {
      const par = soloSeries(prev) && soloReps(p) ? [prev, p] : soloReps(prev) && soloSeries(p) ? [p, prev] : null
      if (par) {
        out[out.length - 1] = { ...prev, fin: p.fin, series: par[0].series, reps: par[1].reps }
        continue
      }
    }
    out.push(p)
  }
  return out
}

function tienePatronCompleto(t: string): boolean {
  const d = buscarDescanso(t)
  return buscarPatrones(d ? enmascarar(t, [d]) : t).some((p) => p.series !== null && p.reps !== '')
}

// ---------------------------------------------------------------- nombre y cláusulas

/** Nivel de paréntesis de cada posición: lo que está entre paréntesis no corta el nombre. */
function profundidades(m: string): number[] {
  const prof: number[] = []
  let d = 0
  for (let i = 0; i < m.length; i++) {
    if (m[i] === '(') d++
    prof.push(d)
    if (m[i] === ')') d = Math.max(0, d - 1)
  }
  return prof
}

function esDigito(c: string | undefined): boolean {
  return c !== undefined && c >= '0' && c <= '9'
}

/** Partes de la línea separadas por coma, punto, " - " o un tramo ya interpretado. */
function clausulas(m: string, prof: number[]): Tramo[] {
  const res: Tramo[] = []
  let ini = 0
  const cortar = (i: number) => {
    res.push({ inicio: ini, fin: i })
    ini = i + 1
  }
  for (let i = 0; i < m.length; i++) {
    const c = m[i]
    if (c === MARCA) cortar(i)
    else if (prof[i] > 0) continue
    else if (c === ',' || c === ';') cortar(i)
    else if ((c === '.' || c === ':') && !(esDigito(m[i - 1]) && esDigito(m[i + 1]))) cortar(i)
    else if ((c === '-' || c === '–' || c === '—') && m[i - 1] === ' ' && m[i + 1] === ' ') cortar(i)
  }
  res.push({ inicio: ini, fin: m.length })
  return res.filter((c) => m.slice(c.inicio, c.fin).trim() !== '')
}

function cortesDeNombre(m: string, prof: number[]): number[] {
  return [...m.matchAll(RE_TECNICA)].map((x) => x.index).filter((i) => prof[i] === 0)
}

function candidato(s: string, c: Tramo, cortes: number[], reConector = RE_CONECTOR): Nombre | null {
  let i = c.inicio
  while (i < c.fin && s[i] === ' ') i++
  const spanInicio = i
  const conector = reConector.exec(s.slice(i, c.fin))
  if (conector) i += conector[0].length
  if (!/\p{L}/u.test(s[i] ?? '')) return null
  let fin = c.fin
  for (const k of cortes) {
    if (k >= i && k < fin) {
      fin = k
      break
    }
  }
  const texto = limpiarTexto(s.slice(i, fin))
  if (!texto) return null
  return { spanInicio, fin, texto }
}

function primerCandidato(
  s: string,
  cls: Tramo[],
  cortes: number[],
  desde: number,
  hasta: number,
): { nombre: Nombre; clausula: Tramo } | null {
  for (const c of cls) {
    if (c.inicio < desde || c.fin > hasta) continue
    const nombre = candidato(s, c, cortes)
    if (nombre) return { nombre, clausula: c }
  }
  return null
}

/** Texto que solo nombra el bloque (grupo muscular, biserie, cardio) y no un ejercicio. */
function esRotulo(t: string): boolean {
  const sobra = t
    .replace(RE_TIPO_SERIE_G, ' ')
    .replace(RE_GRUPO_MUSCULAR, ' ')
    .replace(RE_ROTULO_BLOQUE, ' ')
    .replace(/[\s,/+&()\-–—]+/g, '')
  return sobra === ''
}

// ---------------------------------------------------------------- línea

function analizarLinea(s: string): Analisis {
  const descanso = buscarDescanso(s)
  const base: Tramo[] = descanso ? [descanso] : []
  const encontrados = buscarPatrones(enmascarar(s, base))
  marcarCalentamiento(s, encontrados)
  const patrones = fusionarPatrones(s, encontrados)
  let efectivos = patrones.filter((p) => !p.calentamiento && p.series !== null)
  if (efectivos.length === 0) efectivos = patrones.filter((p) => !p.calentamiento)

  const m = enmascarar(s, [...base, ...patrones])
  const prof = profundidades(m)
  const cortes = cortesDeNombre(m, prof)
  const cls = clausulas(m, prof)

  const arranques: { nombre: Nombre; patron: Patron | null }[] = []
  const primero = efectivos[0]
  if (!primero) {
    const n = primerCandidato(s, cls, cortes, 0, s.length)
    if (n) arranques.push({ nombre: n.nombre, patron: null })
    else {
      // "Entrada en calor: 10 min bici": el rótulo es todo el nombre aunque sea una palabra de técnica.
      const c = cls[0]
      const texto = c && m[c.fin] === ':' ? limpiarTexto(s.slice(c.inicio, c.fin)) : ''
      if (/^\p{L}/u.test(texto) && !RE_TIPO_SERIE.test(texto)) {
        arranques.push({ nombre: { spanInicio: c.inicio, fin: c.fin, texto }, patron: null })
      }
    }
  } else {
    let antes = primerCandidato(s, cls, cortes, 0, primero.inicio)
    // "Abdominales: crunch 3x20": lo anterior a los dos puntos es el rótulo, no el ejercicio.
    if (antes && m[antes.clausula.fin] === ':' && esRotulo(s.slice(antes.clausula.inicio, antes.clausula.fin))) {
      antes = primerCandidato(s, cls, cortes, antes.clausula.fin + 1, primero.inicio) ?? antes
    }
    if (antes) {
      arranques.push({ nombre: antes.nombre, patron: primero })
      // Biserie o varios ejercicios en la misma línea: cada patrón precedido por un nombre abre otro.
      for (let i = 1; i < efectivos.length; i++) {
        const previo = efectivos[i - 1]
        const actual = efectivos[i]
        const ultima = cls.filter((c) => c.inicio >= previo.fin && c.fin <= actual.inicio).at(-1)
        const n = ultima ? candidato(s, ultima, cortes, RE_CONECTOR_ENTRE) : null
        if (n) arranques.push({ nombre: n, patron: actual })
      }
    } else {
      const despues = primerCandidato(s, cls, cortes, primero.fin, s.length)
      if (despues) arranques.push({ nombre: despues.nombre, patron: primero })
    }
  }

  const grupos: Grupo[] = arranques.map((a, g) => {
    const inicio = g === 0 ? 0 : a.nombre.spanInicio
    const fin = g === arranques.length - 1 ? s.length : arranques[g + 1].nombre.spanInicio
    const quitar: Tramo[] = [...base, { inicio: a.nombre.spanInicio, fin: a.nombre.fin }]
    if (a.patron) quitar.push(a.patron)
    return { nombre: a.nombre.texto, patron: a.patron, indicaciones: textoSin(s, inicio, fin, quitar) }
  })

  if (grupos.length > 1) {
    const tipo = RE_TIPO_SERIE.exec(s)
    if (tipo) {
      const etiqueta =
        tipo[1].toLowerCase() === 'super'
          ? 'Superserie'
          : grupos.length === 2
            ? 'Biserie'
            : grupos.length === 3
              ? 'Triserie'
              : 'Circuito'
      for (const g of grupos) {
        const otros = grupos.filter((o) => o !== g).map((o) => minusculaInicial(o.nombre))
        const lista = otros.length === 1 ? otros[0] : `${otros.slice(0, -1).join(', ')} y ${otros.at(-1)}`
        const resto = limpiarTexto(g.indicaciones.replace(RE_TIPO_SERIE_G, ' '))
        g.indicaciones = unir(`${etiqueta} con ${lista}`, resto)
      }
    }
  }
  for (const g of grupos) g.indicaciones = limpiarTexto(g.indicaciones)

  const patronSuelto = primero ?? null
  return {
    descanso: descanso?.texto ?? '',
    empiezaConDescanso: descanso !== null && descanso.inicio === 0 && !primero,
    colaDescanso: descanso ? s.slice(descanso.fin) : '',
    hayPatrones: patrones.length > 0,
    grupos,
    patronSuelto,
    resto: limpiarTexto(textoSin(s, 0, s.length, patronSuelto ? [...base, patronSuelto] : base)),
    restoSinDescanso: limpiarTexto(textoSin(s, 0, s.length, base)),
    lineaLimpia: limpiarTexto(s),
  }
}

// ---------------------------------------------------------------- encabezados y título

interface Encabezado {
  nombre: string
  /** Ejercicio escrito en la misma línea del encabezado ("Día 1: sentadilla 3x12"). */
  resto: string | null
  /** "Día 1 (descanso 1 min entre series)": vale para todo el día. */
  descanso: string
  /** "seccion" ("Rutina A", "Semana 2"): si le sigue otro encabezado es un rótulo, no un día. */
  tipo: 'dia' | 'seccion'
}

function limpiarEncabezado(t: string): string {
  return t
    .replace(/\s+/g, ' ')
    .replace(/[\s:.,;\-–—]+$/u, '')
    .trim()
}

function tienePatron(t: string): boolean {
  const d = buscarDescanso(t)
  return buscarPatrones(d ? enmascarar(t, [d]) : t).length > 0
}

function idEncabezado(id: string): string {
  if (/^[a-z]$/i.test(id)) return id.toUpperCase()
  return id
    .toLowerCase()
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*(y|e)\s*/g, ' $1 ')
}

function nombreSeccion(palabra: string, id: string): string {
  return `${capitalizar(palabra.toLowerCase())} ${idEncabezado(id)}`
}

function prefijoDia(linea: string): { prefijo: string; largo: number } | null {
  let m: RegExpExecArray | null
  if ((m = RE_DIA.exec(linea))) {
    const lista = m[2] ?? ''
    const plural = /s$/i.test(m[1]) || /\D/.test(lista)
    return { prefijo: `${plural ? 'Días' : 'Día'} ${idEncabezado(lista || m[3] || '')}`, largo: m[0].length }
  }
  if ((m = RE_D.exec(linea)) || (m = RE_ORDINAL_NUM.exec(linea))) {
    return { prefijo: `Día ${m[1]}`, largo: m[0].length }
  }
  if ((m = RE_ORDINAL.exec(linea))) {
    return { prefijo: capitalizar(m[0].toLowerCase().replace(/d[ií]a$/, 'día')), largo: m[0].length }
  }
  if ((m = RE_SEMANA.exec(linea))) return { prefijo: capitalizar(m[0].toLowerCase()), largo: m[0].length }
  return null
}

function detectarEncabezado(linea: string): Encabezado | null {
  let tipo: Encabezado['tipo'] = 'dia'
  let prefijo: string | null = null
  let largo = 0
  const seccion = RE_SECCION_DIA.exec(linea)
  const diaDeSeccion = seccion ? prefijoDia(linea.slice(seccion[0].length)) : null
  const dia = prefijoDia(linea)
  if (seccion && diaDeSeccion) {
    prefijo = `${nombreSeccion(seccion[1], seccion[2])} - ${diaDeSeccion.prefijo}`
    largo = seccion[0].length + diaDeSeccion.largo
  } else if (dia) {
    prefijo = dia.prefijo
    largo = dia.largo
  } else {
    const m = RE_RUTINA.exec(linea)
    if (m) {
      prefijo = nombreSeccion(m[1], m[2])
      largo = m[0].length
      tipo = 'seccion'
    }
  }

  if (prefijo === null) {
    if (RE_DIA_DE.test(linea) && linea.length <= ENCABEZADO_MAX && !tienePatron(linea)) {
      return { nombre: limpiarEncabezado(`Día${linea.slice(3)}`), resto: null, descanso: '', tipo }
    }
    return null
  }
  const resto = linea.slice(largo)
  if (tienePatron(resto)) {
    return { nombre: prefijo, resto: resto.replace(/^[\s:.)\-–—]+/u, ''), descanso: '', tipo }
  }
  if (linea.length > ENCABEZADO_MAX) return null
  const d = buscarDescanso(resto)
  const sinDescanso = d ? textoSin(resto, 0, resto.length, [d]).replace(/\(\s*\)/g, ' ') : resto
  return { nombre: limpiarEncabezado(prefijo + sinDescanso), resto: null, descanso: d?.texto ?? '', tipo }
}

function pareceTitulo(linea: string): boolean {
  if (linea.length > TITULO_MAX) return false
  const a = analizarLinea(linea)
  if (a.hayPatrones || a.descanso) return false
  if (RE_TITULO.test(linea)) return true
  return !RE_VOCABULARIO.test(linea)
}

/** Línea tipo "Pecho y bíceps" justo debajo del encabezado del día. */
function esSubtitulo(linea: string): boolean {
  if (/\d/.test(linea) || linea.length > 50) return false
  const t = linea.replace(/[:.]+$/, '').trim()
  const grupos = t.match(RE_GRUPO_MUSCULAR) ?? []
  if (grupos.length === 0) return false
  const sobra = t
    .replace(RE_GRUPO_MUSCULAR, ' ')
    .replace(RE_CONECTOR_SUBTITULO, ' ')
    .replace(/[\s,/+&()\-–—]+/g, '')
  if (sobra) return false
  return grupos.length >= 2 || RE_GRUPO_FUERTE.test(grupos[0] ?? '')
}

// ---------------------------------------------------------------- armado

function nuevoEjercicio(g: Grupo, descanso: string): EjercicioInterno {
  return {
    nombre: g.nombre,
    series: g.patron?.series ?? SERIES_DEFECTO,
    reps: g.patron?.reps ?? '',
    descanso,
    indicaciones: g.indicaciones,
    sinPatron: g.patron === null,
  }
}

function agregarEjercicio(dia: DiaInterno, e: EjercicioInterno): void {
  if (dia.nota) {
    e.indicaciones = unir(dia.nota, e.indicaciones)
    dia.nota = ''
  }
  dia.ejercicios.push(e)
}

function agregarLinea(dia: DiaInterno, linea: string): void {
  const a = analizarLinea(linea)
  const previo = dia.ejercicios.at(-1)

  // Descanso en línea aparte: completa al ejercicio anterior; antes del primero, o como regla
  // general ("entre series") sin descansos cargados, vale para todo el día.
  if (a.empiezaConDescanso) {
    const general = !previo || (a.descanso.includes('entre') && !dia.ejercicios.some((e) => e.descanso))
    // Hasta el primer punto la línea sigue hablando del descanso ("y 2 min entre ejercicios");
    // lo que viene después es otra indicación.
    const corte = a.colaDescanso.search(/[.;](?!\d)/)
    const regla = limpiarEncabezado(a.descanso + (corte < 0 ? a.colaDescanso : a.colaDescanso.slice(0, corte)))
    const nota = corte < 0 ? '' : limpiarTexto(a.colaDescanso.slice(corte + 1))
    if (general && !dia.descansoGeneral) {
      dia.descansoGeneral = regla
      if (previo) previo.indicaciones = unir(previo.indicaciones, nota)
      else dia.nota = unir(dia.nota, nota)
    } else if (previo && !previo.descanso) {
      previo.descanso = a.descanso
      previo.indicaciones = unir(previo.indicaciones, a.restoSinDescanso)
    } else if (previo) {
      previo.indicaciones = unir(previo.indicaciones, a.lineaLimpia)
    } else {
      dia.descansoGeneral = `${dia.descansoGeneral} / ${regla}`
    }
    return
  }

  if (a.grupos.length === 0) {
    // "Press plano" en una línea y "3 x 12" en la siguiente.
    if (previo?.sinPatron && a.patronSuelto) {
      previo.series = a.patronSuelto.series ?? previo.series
      previo.reps = a.patronSuelto.reps
      previo.sinPatron = false
      if (a.descanso && !previo.descanso) previo.descanso = a.descanso
      else if (a.descanso) previo.indicaciones = unir(previo.indicaciones, `Descanso ${a.descanso}`)
      previo.indicaciones = unir(previo.indicaciones, a.resto)
      return
    }
    if (previo) {
      previo.indicaciones = unir(previo.indicaciones, a.lineaLimpia)
      return
    }
    agregarEjercicio(dia, {
      nombre: a.resto || 'Ejercicio',
      series: a.patronSuelto?.series ?? SERIES_DEFECTO,
      reps: a.patronSuelto?.reps ?? '',
      descanso: a.descanso,
      indicaciones: '',
      sinPatron: a.patronSuelto === null,
    })
    return
  }

  for (const g of a.grupos) agregarEjercicio(dia, nuevoEjercicio(g, a.descanso))
}

export function parsearRutina(texto: string): RutinaParseada {
  const lineas = texto
    .split(/\r\n|\r|\n/)
    .map(normalizarLinea)
    .filter((l) => l !== '')
  const encabezados = lineas.map(detectarEncabezado)
  // Sin ningún encabezado de día, dos o más líneas de grupo muscular ("PECHO", "ESPALDA") separan días.
  if (!encabezados.some(Boolean)) {
    const grupos = lineas.flatMap((l, i) => (esSubtitulo(l) ? [i] : []))
    if (grupos.length >= 2) {
      for (const i of grupos) {
        encabezados[i] = { nombre: capitalizar(limpiarEncabezado(lineas[i])), resto: null, descanso: '', tipo: 'dia' }
      }
    }
  }
  // Una sección seguida de otro encabezado ("Semana 2" y abajo "Día 1") es un rótulo: si es la única
  // y va antes que todo, es el título; si no, se antepone al nombre de los días que siguen.
  const rotulos = encabezados.flatMap((e, i) => (e?.tipo === 'seccion' && e.resto === null && encabezados[i + 1] ? [i] : []))
  const rotuloTitulo = rotulos.length === 1 && !encabezados.slice(0, rotulos[0]).some(Boolean) ? rotulos[0] : -1

  const titulos: string[] = []
  const dias: DiaInterno[] = []
  let actual: DiaInterno | null = null
  let recienAbierto = false
  let seccion = ''

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]
    const encabezado = encabezados[i]
    if (encabezado) {
      if (i === rotuloTitulo) {
        titulos.push(encabezado.nombre)
        continue
      }
      if (rotulos.includes(i)) {
        seccion = encabezado.nombre
        continue
      }
      let nombre = encabezado.nombre
      if (encabezado.tipo === 'seccion') seccion = ''
      else if (seccion) nombre = `${seccion} - ${nombre}`
      actual = { nombre, implicito: false, descansoGeneral: encabezado.descanso, nota: '', ejercicios: [] }
      dias.push(actual)
      recienAbierto = encabezado.resto === null
      if (encabezado.resto) agregarLinea(actual, encabezado.resto)
      continue
    }

    if (actual && recienAbierto && actual.ejercicios.length === 0 && esSubtitulo(linea)) {
      actual.nombre = `${actual.nombre} - ${capitalizar(limpiarEncabezado(linea))}`
      recienAbierto = false
      continue
    }
    recienAbierto = false

    if (!actual) {
      // Lo que va justo antes del primer día es el encabezado del texto (el alumno), salvo que traiga números.
      const antesDelDia = encabezados[i + 1] != null && !/\d/.test(linea) && linea.length <= TITULO_MAX
      if (antesDelDia || pareceTitulo(linea)) {
        titulos.push(limpiarEncabezado(linea))
        continue
      }
      actual = { nombre: '', implicito: true, descansoGeneral: '', nota: '', ejercicios: [] }
      dias.push(actual)
    }
    agregarLinea(actual, linea)
  }

  const hayEncabezados = dias.some((d) => !d.implicito)
  const salida: DiaParseado[] = dias
    .filter((d) => d.ejercicios.length > 0)
    .map((d) => ({
      nombre: d.implicito ? (hayEncabezados ? 'General' : 'Día 1') : d.nombre,
      ejercicios: d.ejercicios.map((e) => ({
        nombre: e.nombre,
        series: e.series,
        reps: e.reps,
        descanso: e.descanso || d.descansoGeneral,
        indicaciones: e.indicaciones,
      })),
    }))

  return { titulo: titulos.join(' - '), dias: salida }
}
