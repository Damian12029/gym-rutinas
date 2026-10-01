import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Search, UserPlus } from 'lucide-react'
import { db, type EnSala } from '../lib/db'
import { contarCompletos, diaQueLeToca, useAlumnos, useUltimosRegistros } from '../lib/consultas'
import { useHoy } from '../lib/hooks'
import { entrarEnSala, rutaSesion, useSala } from '../lib/sala'
import type { Alumno, Dia, Registro, Rutina } from '../lib/tipos'
import { avisarError } from '../lib/aviso'
import { claveEjercicio, iniciales, nombresCortos } from '../lib/util'
import { Hoja, claseInput, cx } from './ui'

interface EnSalaCompleto {
  entrada: EnSala
  alumno: Alumno
  rutina: Rutina
  dia: Dia
  completos: number
}

/** Los alumnos en sala con sus datos y lo que llevan hoy. Descarta los que ya no existen. */
function useSalaCompleta(): EnSalaCompleto[] | undefined {
  const sala = useSala()
  const alumnos = useAlumnos()
  const hoyISO = useHoy()
  const ids = sala?.map((e) => e.alumnoId) ?? []
  const deHoy = useLiveQuery(
    () =>
      ids.length
        ? db.registros
            .where('[alumnoId+fecha]')
            .anyOf(ids.map((id) => [id, hoyISO]))
            .toArray()
        : Promise.resolve([] as Registro[]),
    [ids.join('|'), hoyISO],
  )
  return useMemo(() => {
    if (!sala || !alumnos || !deHoy) return undefined
    const porId = new Map(alumnos.map((a) => [a.id, a]))
    const lista: EnSalaCompleto[] = []
    for (const entrada of sala) {
      const alumno = porId.get(entrada.alumnoId)
      const rutina = alumno?.rutinas.find((r) => r.id === entrada.rutinaId)
      const dia = rutina?.dias.find((d) => d.id === entrada.diaId)
      if (!alumno || !rutina || !dia) continue
      const completos = contarCompletos(
        dia,
        deHoy.filter((r) => r.alumnoId === alumno.id),
      )
      lista.push({ entrada, alumno, rutina, dia, completos })
    }
    return lista
  }, [sala, alumnos, deHoy])
}

/**
 * Botones de los alumnos que están entrenando, fijos arriba de la pantalla de anotar.
 * Pasar de uno a otro reemplaza la pantalla (atrás no recorre a todos) y vuelve a la
 * altura donde estaba cada uno.
 */
export function BarraSala({ alumnoActualId }: { alumnoActualId: string }) {
  const navigate = useNavigate()
  const lista = useSalaCompleta()
  const [sumando, setSumando] = useState(false)
  const activo = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activo.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [alumnoActualId, lista?.length])

  if (!lista) return <div className="h-12" />
  const cortos = nombresCortos(lista.map((x) => x.alumno))

  return (
    <>
      <nav aria-label="Alumnos entrenando" className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lista.map(({ alumno, rutina, dia, completos }) => {
          const esActual = alumno.id === alumnoActualId
          return (
            <button
              key={alumno.id}
              ref={esActual ? activo : undefined}
              type="button"
              aria-current={esActual ? 'page' : undefined}
              aria-label={`${alumno.nombre}, ${dia.nombre}, ${completos} de ${dia.ejercicios.length} ejercicios completos`}
              onClick={() => {
                if (!esActual) navigate(rutaSesion(alumno.id, rutina.id, dia.id), { replace: true, state: { sala: true } })
              }}
              className={cx(
                'flex h-11 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-sm font-semibold',
                esActual ? 'bg-acento-boton text-sobre-acento' : 'bg-sup-2 text-texto active:brightness-95',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sup text-xs font-bold text-acento">{iniciales(alumno.nombre)}</span>
              {cortos.get(alumno.id)}
              <span className={cx('text-xs font-medium tabular-nums', esActual ? 'opacity-90' : 'text-texto-3')}>
                {completos}/{dia.ejercicios.length}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setSumando(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-borde px-3.5 text-sm font-semibold text-acento active:bg-acento-suave"
        >
          <UserPlus className="h-4 w-4" /> Alumno
        </button>
      </nav>

      <Hoja abierta={sumando} onCerrar={() => setSumando(false)} titulo="¿Quién llegó?" cerrarAlTocarFuera>
        {sumando && <SelectorAlumno excluir={new Set(lista.map((x) => x.alumno.id))} onElegido={() => setSumando(false)} reemplazar />}
      </Hoja>
    </>
  )
}

/**
 * Lista para sumar a alguien a la sala: un toque va directo al día que le toca.
 * "Otro día" deja elegir si hoy hace uno distinto.
 */
function SelectorAlumno({ excluir, onElegido, reemplazar }: { excluir: Set<string>; onElegido: () => void; reemplazar: boolean }) {
  const navigate = useNavigate()
  const alumnos = useAlumnos()
  const ultimos = useUltimosRegistros()
  const hoyISO = useHoy()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)

  if (!alumnos || !ultimos) return <div className="h-40 animate-pulse rounded-2xl bg-sup-2" />
  const q = claveEjercicio(busqueda)
  const candidatos = alumnos.filter((a) => !excluir.has(a.id) && (!q || claveEjercicio(a.nombre).includes(q)))

  async function ir(alumno: Alumno, rutina: Rutina, dia: Dia) {
    try {
      await entrarEnSala(alumno.id, rutina.id, dia.id)
      onElegido()
      navigate(rutaSesion(alumno.id, rutina.id, dia.id), { replace: reemplazar, state: { sala: true } })
    } catch (e) {
      avisarError(e)
    }
  }

  return (
    <div>
      {alumnos.length > 6 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-texto-3" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar alumno"
            aria-label="Buscar alumno"
            className={`${claseInput} pl-10`}
          />
        </div>
      )}
      {candidatos.length === 0 ? (
        <p className="py-6 text-center text-sm text-texto-2">{alumnos.length === excluir.size ? 'Ya están todos en la sala.' : 'Ningún alumno coincide.'}</p>
      ) : (
        <ul className="-mx-1 max-h-[60dvh] divide-y divide-borde overflow-y-auto">
          {candidatos.map((a) => {
            const rutina = a.rutinas.find((r) => r.activa)
            const dias = rutina?.dias.filter((d) => d.ejercicios.length > 0) ?? []
            const toca = rutina ? diaQueLeToca(rutina, ultimos.get(a.id), hoyISO) : undefined
            return (
              <li key={a.id} className="px-1 py-1">
                <div className="flex items-center gap-1">
                  {rutina && toca ? (
                    <button
                      type="button"
                      onClick={() => void ir(a, rutina, toca)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left active:bg-sup-2"
                    >
                      <Avatar nombre={a.nombre} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{a.nombre}</span>
                        <span className="block truncate text-sm text-acento">Le toca {toca.nombre}</span>
                      </span>
                    </button>
                  ) : (
                    <Link to={`/alumno/${a.id}`} onClick={onElegido} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 active:bg-sup-2">
                      <Avatar nombre={a.nombre} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{a.nombre}</span>
                        <span className="block truncate text-sm text-texto-3">Sin rutina: armala en su ficha</span>
                      </span>
                    </Link>
                  )}
                  {rutina && dias.length > 1 && (
                    <button
                      type="button"
                      aria-expanded={abierto === a.id}
                      aria-label={`Otro día para ${a.nombre}`}
                      onClick={() => setAbierto(abierto === a.id ? null : a.id)}
                      className="flex h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm text-texto-2 active:bg-sup-2"
                    >
                      Otro día <ChevronDown className={cx('h-4 w-4 transition-transform', abierto === a.id && 'rotate-180')} />
                    </button>
                  )}
                </div>
                {rutina && abierto === a.id && (
                  <div className="flex flex-wrap gap-2 px-2 pb-2 pt-1">
                    {dias.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => void ir(a, rutina, d)}
                        className={cx(
                          'h-10 rounded-full border px-3.5 text-sm font-semibold',
                          d.id === toca?.id ? 'border-acento bg-acento-suave text-acento' : 'border-borde text-texto',
                        )}
                      >
                        {d.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Avatar({ nombre }: { nombre: string }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acento-suave text-sm font-bold text-acento">
      {iniciales(nombre)}
    </span>
  )
}
