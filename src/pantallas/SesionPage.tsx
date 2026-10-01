import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, LogOut, MessageSquareText, Pencil, Plus, Trophy, TrendingUp, UserRound } from 'lucide-react'
import {
  agruparPorEjercicio,
  anteriorA,
  contarCompletos,
  notaAnteriorA,
  recordAntesDe,
  useAlumno,
  useRegistrosAlumno,
  type HistorialEjercicio,
} from '../lib/consultas'
import { guardarRegistro } from '../lib/datos'
import { avisarError } from '../lib/aviso'
import type { Ejercicio, Registro } from '../lib/tipos'
import { useHoy } from '../lib/hooks'
import { rutaAnterior } from '../lib/navegacion'
import { entrarEnSala, rutaSesion, salirDeSala, useSala } from '../lib/sala'
import { BarraSala } from '../componentes/Sala'
import { claveEjercicio, diaSemana, esFechaISO, fechaCorta, formatoKg, leerPeso, pesoATexto, pesoMaximo } from '../lib/util'
import { Boton, BotonIcono, Cargando, Encabezado, NoEncontrado, Pagina, Vacio, claseInput, cx, useIrA, useVolver } from '../componentes/ui'

const MAX_SERIES = 10

export default function SesionPage() {
  const { alumnoId, rutinaId, diaId } = useParams()
  const [params, setParams] = useSearchParams()
  const alumno = useAlumno(alumnoId)
  const registros = useRegistrosAlumno(alumnoId)
  const sala = useSala()
  const volver = useVolver()
  const irA = useIrA()
  const navigate = useNavigate()

  const hoyISO = useHoy()
  const fechaParam = params.get('fecha')
  const fecha = esFechaISO(fechaParam) && fechaParam <= hoyISO ? fechaParam : hoyISO

  const historial = useMemo(() => agruparPorEjercicio(registros ?? []), [registros])
  const deLaFecha = useMemo(() => {
    const mapa = new Map<string, Registro>()
    for (const r of registros ?? []) if (r.fecha === fecha) mapa.set(r.ejercicioId, r)
    return mapa
  }, [registros, fecha])

  const rutina = alumno?.rutinas.find((r) => r.id === rutinaId)
  const dia = rutina?.dias.find((d) => d.id === diaId)

  // Si se borró la rutina o el día (p. ej. desde el lápiz de esta pantalla), se vuelve
  // a la ficha del alumno en lugar de quedar en "No encontrado".
  const faltaDia = !!alumno && registros !== undefined && !dia
  const yaVolvio = useRef(false)
  useEffect(() => {
    if (!faltaDia || !alumno || yaVolvio.current) return
    yaVolvio.current = true
    volver(`/alumno/${alumno.id}`)
  }, [faltaDia, alumno, volver])

  // Entra a la sala al anotar el primer peso (mirar no cuenta). Si ya estaba y se pasa a
  // otro día, la sala se queda con el día nuevo.
  const esHoy = fecha === hoyISO
  const idAlumno = alumno?.id
  const idRutina = rutina?.id
  const idDia = dia?.id
  const yaEnSala = !!idAlumno && (sala?.some((e) => e.alumnoId === idAlumno) ?? false)
  useEffect(() => {
    if (idAlumno && idRutina && idDia && esHoy && yaEnSala) entrarEnSala(idAlumno, idRutina, idDia).catch(avisarError)
  }, [idAlumno, idRutina, idDia, esHoy, yaEnSala])

  if (alumno === undefined || registros === undefined || faltaDia) return <Cargando />
  if (!alumno || !rutina || !dia) return <NoEncontrado texto="Ese alumno no existe o se borró." />

  const completos = contarCompletos(dia, [...deLaFecha.values()])
  const enSala = sala?.some((e) => e.alumnoId === alumno.id) ?? false

  // Atrás vuelve a la ficha si se entró desde ahí; si se llegó cambiando de alumno en la
  // barra, la pantalla de abajo es de otro alumno y se va al inicio.
  function atras() {
    if (!alumno) return
    const previa = rutaAnterior()
    if (previa === `/alumno/${alumno.id}` || previa?.startsWith(`/alumno/${alumno.id}/`)) volver(`/alumno/${alumno.id}`)
    else irA('/')
  }

  async function termino() {
    if (!alumno) return
    try {
      await salirDeSala(alumno.id)
      const siguiente = sala?.find((e) => e.alumnoId !== alumno.id)
      if (siguiente) navigate(rutaSesion(siguiente.alumnoId, siguiente.rutinaId, siguiente.diaId), { replace: true, state: { sala: true } })
      else irA('/')
    } catch (e) {
      avisarError(e)
    }
  }

  function irAlDia(id: string) {
    if (!alumno || !rutina) return
    const busqueda = params.toString()
    navigate(`${rutaSesion(alumno.id, rutina.id, id)}${busqueda ? `?${busqueda}` : ''}`, { replace: true })
  }

  function cambiarFecha(nueva: string) {
    if (!esFechaISO(nueva)) return
    setParams(nueva === hoyISO ? {} : { fecha: nueva }, { replace: true })
  }

  return (
    <>
      <Encabezado
        titulo={alumno.nombre}
        subtitulo={rutina.activa ? dia.nombre : `${dia.nombre} · ${rutina.nombre} (anterior)`}
        onVolver={atras}
        debajo={<BarraSala actual={{ alumno, rutina, dia, completos, esHoy }} />}
        acciones={
          <>
            <Link
              to={`/alumno/${alumno.id}/rutina/${rutina.id}`}
              aria-label="Editar rutina"
              className="flex h-11 w-11 items-center justify-center rounded-full text-texto-2 active:bg-sup-2"
            >
              <Pencil className="h-5 w-5" />
            </Link>
            <Link
              to={`/alumno/${alumno.id}`}
              aria-label="Ficha del alumno: progreso, rutinas y datos"
              className="flex h-11 w-11 items-center justify-center rounded-full text-texto-2 active:bg-sup-2"
            >
              <UserRound className="h-5 w-5" />
            </Link>
          </>
        }
      />
      <Pagina>
        {rutina.dias.length > 1 && (
          <div
            role="tablist"
            aria-label="Días de la rutina"
            className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {rutina.dias.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={d.id === dia.id}
                onClick={() => d.id !== dia.id && irAlDia(d.id)}
                className={cx(
                  'h-10 max-w-[12rem] shrink-0 truncate rounded-full px-4 text-sm font-semibold',
                  d.id === dia.id ? 'bg-texto text-fondo' : 'bg-sup-2 text-texto-2 active:brightness-95',
                )}
              >
                {d.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="mb-4 flex items-center gap-2">
          <label className="relative flex h-11 items-center gap-2 rounded-xl bg-sup-2 px-3 font-semibold">
            <CalendarDays className="h-5 w-5 text-acento" />
            {fecha === hoyISO ? 'Hoy' : diaSemana(fecha)} {fechaCorta(fecha)}
            <input
              type="date"
              value={fecha}
              max={hoyISO}
              onChange={(e) => cambiarFecha(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker()
                } catch {
                  // Safari viejo: el toque ya abre el selector.
                }
              }}
              aria-label="Fecha de la sesión"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          {fecha !== hoyISO && (
            <button
              type="button"
              onClick={() => cambiarFecha(hoyISO)}
              className="h-11 rounded-xl px-3 text-sm font-semibold text-acento active:bg-acento-suave"
            >
              Volver a hoy
            </button>
          )}
          {dia.ejercicios.length > 0 && (
            <span className="ml-auto text-sm text-texto-3">
              {completos}/{dia.ejercicios.length} completos
            </span>
          )}
        </div>

        {dia.ejercicios.length === 0 ? (
          <Vacio titulo="Este día no tiene ejercicios">
            <Link
              to={`/alumno/${alumno.id}/rutina/${rutina.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-acento-boton px-4 font-semibold text-sobre-acento active:bg-acento-fuerte"
            >
              <Pencil className="h-5 w-5" /> Cargar ejercicios
            </Link>
          </Vacio>
        ) : (
          <ol className="space-y-3">
            {dia.ejercicios.map((e, i) => (
              <TarjetaEjercicio
                key={`${e.id}|${fecha}`}
                alumnoId={alumno.id}
                sala={esHoy ? { rutinaId: rutina.id, diaId: dia.id } : undefined}
                ejercicio={e}
                numero={i + 1}
                fecha={fecha}
                registro={deLaFecha.get(e.id)}
                historial={historial.get(claveEjercicio(e.nombre))}
              />
            ))}
          </ol>
        )}
        <p className="mt-6 text-center text-xs text-texto-3">Lo que anotás se guarda solo.</p>
        {enSala && (
          <Boton variante="secundario" className="mt-4 w-full" onClick={() => void termino()}>
            <LogOut className="h-5 w-5" /> {alumno.nombre.split(/\s+/)[0]} terminó por hoy
          </Boton>
        )}
      </Pagina>
    </>
  )
}

function textosIniciales(registro: Registro | undefined, series: number): string[] {
  const pesos = registro?.pesos ?? []
  return Array.from({ length: Math.max(series, pesos.length) }, (_, i) => pesoATexto(pesos[i]))
}

/** Enter en el teclado numérico pasa a la próxima serie, aunque sea del ejercicio siguiente. */
function focoSiguiente(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const todos = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-peso]'))
  const siguiente = todos[todos.indexOf(e.currentTarget) + 1]
  if (siguiente) siguiente.focus()
  else e.currentTarget.blur()
}

function TarjetaEjercicio({
  alumnoId,
  sala,
  ejercicio,
  numero,
  fecha,
  registro,
  historial,
}: {
  alumnoId: string
  /** Solo hoy: anotar pone al alumno en sala con este día. */
  sala: { rutinaId: string; diaId: string } | undefined
  ejercicio: Ejercicio
  numero: number
  fecha: string
  registro: Registro | undefined
  historial: HistorialEjercicio | undefined
}) {
  // Lo que se tipea manda mientras la tarjeta está en pantalla; la base solo se lee al montar.
  const [textos, setTextos] = useState(() => textosIniciales(registro, ejercicio.series))
  const [nota, setNota] = useState(registro?.nota ?? '')
  const [notaAbierta, setNotaAbierta] = useState(!!registro?.nota)
  const [errorGuardado, setErrorGuardado] = useState(false)
  const ultimoGuardado = useRef<Promise<void>>(Promise.resolve())

  const series = Math.max(ejercicio.series, textos.length)
  const celdas = Array.from({ length: series }, (_, i) => textos[i] ?? '')
  const pesos = celdas.map((t) => leerPeso(t) ?? null)

  const anterior = historial ? anteriorA(historial.registros, fecha, ejercicio.id) : null
  const notaAnterior = historial ? notaAnteriorA(historial.registros, fecha) : null
  const record = historial ? recordAntesDe(historial.registros, fecha) : null
  const maxHoy = pesoMaximo(pesos)
  const esRecord = maxHoy != null && record != null && maxHoy > record.peso
  const completo = pesos.slice(0, ejercicio.series).every((p) => p != null)
  const vacio = pesos.every((p) => p == null)
  const hayInvalidos = celdas.some((t) => leerPeso(t) === undefined)

  function guardar(nuevosTextos: string[], nuevaNota: string) {
    const nuevosPesos = nuevosTextos.map((t) => leerPeso(t) ?? null)
    // Encadenado: si se tipea rápido, las escrituras llegan en orden.
    ultimoGuardado.current = ultimoGuardado.current
      .then(() => guardarRegistro({ alumnoId, ejercicio, fecha, pesos: nuevosPesos, nota: nuevaNota, sala }))
      .then(
        () => setErrorGuardado(false),
        (e: unknown) => {
          // En iPhone el aviso flotante queda detrás del teclado: el error se marca en la tarjeta.
          setErrorGuardado(true)
          avisarError(e)
        },
      )
  }

  function cambiarPeso(i: number, valor: string) {
    const nuevos = [...celdas]
    nuevos[i] = valor
    setTextos(nuevos)
    guardar(nuevos, nota)
  }

  function repetirAnterior() {
    if (!anterior) return
    const nuevos = Array.from({ length: Math.max(ejercicio.series, anterior.pesos.length) }, (_, i) => pesoATexto(anterior.pesos[i]))
    setTextos(nuevos)
    guardar(nuevos, nota)
  }

  return (
    <li className={cx('rounded-2xl border bg-sup p-4', errorGuardado ? 'border-peligro' : completo ? 'border-ok/50' : 'border-borde')}>
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            completo ? 'bg-ok-fondo text-white' : 'bg-sup-2 text-texto-2',
          )}
          aria-label={completo ? 'Completo' : undefined}
        >
          {completo ? <Check className="h-4 w-4" /> : numero}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug">{ejercicio.nombre}</h2>
          <p className="mt-0.5 text-sm font-medium text-acento">
            {ejercicio.series} {ejercicio.reps ? `× ${ejercicio.reps}` : ejercicio.series === 1 ? 'serie' : 'series'}
            {ejercicio.descanso && <span className="font-normal text-texto-3"> · Descanso {ejercicio.descanso}</span>}
          </p>
          {ejercicio.indicaciones && <p className="mt-1 text-sm text-texto-2">{ejercicio.indicaciones}</p>}
        </div>
        {historial && (
          <Link
            to={`/alumno/${alumnoId}/progreso/${encodeURIComponent(historial.clave)}`}
            aria-label={`Progreso de ${ejercicio.nombre}`}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-texto-3 active:bg-sup-2"
          >
            <TrendingUp className="h-5 w-5" />
          </Link>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-3">
          {anterior ? (
            <span>
              Anterior ({fechaCorta(anterior.fecha)}):{' '}
              <span className="font-semibold tabular-nums text-texto-2">{anterior.pesos.map((p) => (p == null ? '–' : formatoKg(p))).join(' · ')} kg</span>
            </span>
          ) : (
            <span>Primera vez</span>
          )}
          {record && !esRecord && (
            <span>
              Récord <span className="font-semibold tabular-nums text-texto-2">{formatoKg(record.peso)} kg</span>
            </span>
          )}
          {esRecord && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-suave px-2 py-0.5 font-semibold text-ok">
              <Trophy className="h-3.5 w-3.5" /> Nuevo récord
            </span>
          )}
        </div>
        {!notaAbierta && (
          <BotonIcono etiqueta={`Agregar nota a ${ejercicio.nombre}`} className="-mr-2 h-10 w-10 shrink-0 text-texto-3" onClick={() => setNotaAbierta(true)}>
            <MessageSquareText className="h-5 w-5" />
          </BotonIcono>
        )}
      </div>
      {notaAnterior && (
        <p className="mt-1 text-xs italic text-texto-3">
          Nota del {fechaCorta(notaAnterior.fecha)}: {notaAnterior.nota}
        </p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        {celdas.map((t, i) => {
          const invalido = leerPeso(t) === undefined
          const previo = anterior?.pesos[i]
          return (
            <label key={i} className="block">
              <span className="mb-0.5 block text-center text-[11px] font-medium text-texto-3">Serie {i + 1}</span>
              <input
                data-peso
                value={t}
                onChange={(e) => cambiarPeso(i, e.target.value)}
                onKeyDown={focoSiguiente}
                inputMode="decimal"
                enterKeyHint="next"
                autoComplete="off"
                placeholder={previo != null ? pesoATexto(previo) : 'kg'}
                aria-label={`${ejercicio.nombre}, serie ${i + 1}, kilos`}
                aria-invalid={invalido || undefined}
                className={cx(
                  'h-12 w-full rounded-xl border bg-sup-2 text-center text-lg font-semibold tabular-nums text-texto outline-none placeholder:font-normal placeholder:text-texto-3 focus:border-acento focus:bg-sup focus:ring-2 focus:ring-acento/25',
                  invalido ? 'border-peligro' : 'border-transparent',
                )}
              />
            </label>
          )
        })}
        {series < MAX_SERIES && (
          <button
            type="button"
            onClick={() => setTextos([...celdas, ''])}
            aria-label="Agregar una serie"
            className="mt-[18px] flex h-12 items-center justify-center rounded-xl border border-dashed border-borde text-texto-3 active:bg-sup-2"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      {hayInvalidos && <p className="mt-1.5 text-xs font-medium text-peligro">Escribí solo el número, por ejemplo 42,5. Lo marcado en rojo no se guarda.</p>}
      {errorGuardado && (
        <button
          type="button"
          onClick={() => guardar(celdas, nota)}
          className="mt-2 w-full rounded-lg bg-peligro-suave px-3 py-2.5 text-sm font-semibold text-peligro active:brightness-95"
        >
          No se pudo guardar. Tocá para reintentar.
        </button>
      )}
      {anterior && vacio && (
        <button type="button" onClick={repetirAnterior} className="-ml-2 mt-1 h-10 rounded-lg px-2 text-sm font-semibold text-acento active:bg-acento-suave">
          Repetir pesos del {fechaCorta(anterior.fecha)}
        </button>
      )}
      {notaAbierta && (
        <textarea
          // Si ya había nota se muestra abierta al entrar; si no, se abrió con el botón.
          autoFocus={!registro?.nota}
          value={nota}
          onChange={(e) => {
            setNota(e.target.value)
            guardar(celdas, e.target.value)
          }}
          rows={2}
          placeholder="Nota (ej.: le costó la última serie)"
          aria-label={`Nota de ${ejercicio.nombre}`}
          className={cx(claseInput, 'mt-2')}
        />
      )}
    </li>
  )
}
