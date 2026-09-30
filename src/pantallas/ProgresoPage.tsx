import { useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import GraficoProgreso, { Minilinea } from '../componentes/GraficoProgreso'
import { agruparPorEjercicio, useAlumno, useRegistrosAlumno, type HistorialEjercicio } from '../lib/consultas'
import { claveEjercicio, diaSemana, fechaCorta, formatoKg, haceCuanto, pesoMaximo } from '../lib/util'
import { Cargando, Encabezado, NoEncontrado, Pagina, Vacio, cx } from '../componentes/ui'

interface Resumen {
  historial: HistorialEjercicio
  /** Máximo de cada sesión con peso, en orden de fecha. */
  maximos: { fecha: string; valor: number }[]
}

/** Un punto por fecha: si ese día hubo dos ejercicios con el mismo nombre, queda el mayor. */
function resumir(h: HistorialEjercicio): Resumen {
  const porFecha = new Map<string, number>()
  for (const r of h.registros) {
    const max = pesoMaximo(r.pesos)
    const previo = porFecha.get(r.fecha)
    if (max != null && (previo == null || max > previo)) porFecha.set(r.fecha, max)
  }
  // h.registros viene ordenado por fecha, y el Map respeta el orden de inserción.
  return { historial: h, maximos: [...porFecha].map(([fecha, valor]) => ({ fecha, valor })) }
}

function Diferencia({ desde, hasta }: { desde: number; hasta: number }) {
  const d = Math.round((hasta - desde) * 100) / 100
  if (d === 0) return <span className="text-texto-3">sin cambio</span>
  return (
    <span className={cx('font-semibold tabular-nums', d > 0 ? 'text-ok' : 'text-peligro')}>
      {d > 0 ? '+' : '−'}
      {formatoKg(Math.abs(d))} kg
    </span>
  )
}

export function ProgresoAlumno() {
  const { alumnoId } = useParams()
  const alumno = useAlumno(alumnoId)
  const registros = useRegistrosAlumno(alumnoId)

  const lista = useMemo(() => {
    if (!alumno || !registros) return []
    const resumenes = [...agruparPorEjercicio(registros).values()].map(resumir).filter((r) => r.maximos.length > 0)
    // Primero los ejercicios de la rutina actual, en su orden; después el resto por fecha.
    const orden = new Map<string, number>()
    alumno.rutinas
      .find((r) => r.activa)
      ?.dias.flatMap((d) => d.ejercicios)
      .forEach((e, i) => {
        const k = claveEjercicio(e.nombre)
        if (!orden.has(k)) orden.set(k, i)
      })
    return resumenes.sort((a, b) => {
      const oa = orden.get(a.historial.clave) ?? Infinity
      const ob = orden.get(b.historial.clave) ?? Infinity
      if (oa !== ob) return oa - ob
      const fa = a.maximos[a.maximos.length - 1].fecha
      const fb = b.maximos[b.maximos.length - 1].fecha
      return fa < fb ? 1 : fa > fb ? -1 : 0
    })
  }, [alumno, registros])

  if (alumno === undefined || registros === undefined) return <Cargando />
  if (!alumno) return <NoEncontrado texto="Ese alumno no existe o se borró." />

  return (
    <>
      <Encabezado titulo="Progreso" subtitulo={alumno.nombre} volverA={`/alumno/${alumno.id}`} />
      <Pagina>
        {lista.length === 0 ? (
          <Vacio titulo="Todavía no hay pesos anotados" texto="Cuando anotes pesos en un día de la rutina, acá vas a ver cómo evoluciona cada ejercicio." />
        ) : (
          <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-sup">
            {lista.map(({ historial, maximos }) => {
              const primero = maximos[0]
              const ultimo = maximos[maximos.length - 1]
              return (
                <li key={historial.clave}>
                  <Link
                    to={`/alumno/${alumno.id}/progreso/${encodeURIComponent(historial.clave)}`}
                    className="flex items-center gap-2 px-4 py-3 active:bg-sup-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{historial.nombre}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <p className="min-w-0 flex-1 text-xs text-texto-3">
                          {maximos.length} {maximos.length === 1 ? 'sesión' : 'sesiones'} · {haceCuanto(ultimo.fecha)}
                        </p>
                        <Minilinea valores={maximos.map((m) => m.valor)} />
                        <div className="min-w-16 shrink-0 whitespace-nowrap text-right leading-tight">
                          <p className="font-semibold tabular-nums">{formatoKg(ultimo.valor)} kg</p>
                          <p className="text-xs">
                            {maximos.length > 1 ? <Diferencia desde={primero.valor} hasta={ultimo.valor} /> : <span className="text-texto-3">primera</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-texto-3" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Pagina>
    </>
  )
}

export function ProgresoEjercicio() {
  const { alumnoId, clave } = useParams()
  const alumno = useAlumno(alumnoId)
  const registros = useRegistrosAlumno(alumnoId)

  const resumen = useMemo(() => {
    const h = registros && clave ? agruparPorEjercicio(registros).get(clave) : undefined
    return h ? resumir(h) : null
  }, [registros, clave])

  if (alumno === undefined || registros === undefined) return <Cargando />
  if (!alumno) return <NoEncontrado texto="Ese alumno no existe o se borró." />
  const volver = `/alumno/${alumno.id}/progreso`
  if (!resumen) return <NoEncontrado texto="No hay nada anotado de ese ejercicio." volverA={volver} />

  const { historial, maximos } = resumen
  const record = maximos.reduce<(typeof maximos)[number] | null>((m, x) => (!m || x.valor > m.valor ? x : m), null)
  const sesiones = [...historial.registros].reverse()

  return (
    <>
      <Encabezado titulo={historial.nombre} subtitulo={`${alumno.nombre} · Progreso`} volverA={volver} />
      <Pagina>
        {maximos.length > 0 && record && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <Dato etiqueta="Récord" valor={`${formatoKg(record.valor)} kg`} detalle={fechaCorta(record.fecha)} />
              <Dato etiqueta="Primera vez" valor={`${formatoKg(maximos[0].valor)} kg`} detalle={fechaCorta(maximos[0].fecha)} />
              <Dato
                etiqueta="Cambio"
                valor={maximos.length > 1 ? <Diferencia desde={maximos[0].valor} hasta={maximos[maximos.length - 1].valor} /> : '–'}
                detalle={`${maximos.length} ${maximos.length === 1 ? 'sesión' : 'sesiones'}`}
              />
            </div>

            <section className="mb-6 rounded-2xl border border-borde bg-sup p-3">
              <h2 className="mb-1 px-1 text-sm font-semibold">Peso máximo por sesión (kg)</h2>
              <GraficoProgreso puntos={maximos} />
            </section>
          </>
        )}

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-3">Sesiones</h2>
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-sup">
          {sesiones.map((r) => {
            const max = pesoMaximo(r.pesos)
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-baseline gap-3">
                  <span className="w-20 shrink-0 text-sm text-texto-2">
                    {diaSemana(r.fecha)} {fechaCorta(r.fecha)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm tabular-nums text-texto-2">
                    {r.pesos.some((p) => p != null) ? r.pesos.map((p) => (p == null ? '–' : formatoKg(p))).join(' · ') : 'sin pesos'}
                  </span>
                  {max != null && <span className="shrink-0 font-semibold tabular-nums">{formatoKg(max)} kg</span>}
                </div>
                {r.nota && <p className="mt-1 pl-[5.75rem] text-xs italic text-texto-3">{r.nota}</p>}
              </li>
            )
          })}
        </ul>
      </Pagina>
    </>
  )
}

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-sup px-3 py-2.5">
      <p className="text-xs text-texto-3">{etiqueta}</p>
      <p className="mt-0.5 text-lg font-semibold leading-tight">{valor}</p>
      <p className="text-xs text-texto-3">{detalle}</p>
    </div>
  )
}
