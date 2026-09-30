import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClipboardPaste } from 'lucide-react'
import { useAlumno, useAlumnos } from '../lib/consultas'
import { clonarDias, crearRutina, diasDesdeTexto } from '../lib/datos'
import { parsearRutina } from '../lib/parser'
import { avisar, avisarError } from '../lib/aviso'
import type { Dia } from '../lib/tipos'
import { fechaCorta, hoy, nombreMes } from '../lib/util'
import { BarraInferior, Boton, Campo, Cargando, Encabezado, NoEncontrado, Pagina, claseInput, cx, useVolver } from '../componentes/ui'

type Modo = 'pegar' | 'copiar' | 'vacia'

const EJEMPLO = `Día 1
Press plano con barra 3 x 10. Descanso 1:30 min.
Curl con barra 3 x 12 a 15. Descanso 1 min.

Día 2
Prensa 4 x 12. Descanso 2 min.`

export default function NuevaRutina() {
  const { alumnoId } = useParams()
  const navigate = useNavigate()
  const volver = useVolver()
  const alumno = useAlumno(alumnoId)
  const alumnos = useAlumnos()
  const [modo, setModo] = useState<Modo>('pegar')
  const [nombre, setNombre] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [origen, setOrigen] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const parseo = useMemo(() => parsearRutina(texto), [texto])

  // Todas las rutinas cargadas, para copiar una (de este alumno o de otro).
  const rutinasParaCopiar = useMemo(
    () =>
      (alumnos ?? []).flatMap((a) =>
        a.rutinas
          .filter((r) => r.dias.some((d) => d.ejercicios.length))
          .map((r) => ({ clave: `${a.id}|${r.id}`, alumno: a.nombre, esteAlumno: a.id === alumnoId, rutina: r })),
      ),
    [alumnos, alumnoId],
  )
  const copiada = rutinasParaCopiar.find((x) => x.clave === origen)

  if (alumno === undefined || alumnos === undefined) return <Cargando />
  if (!alumno) return <NoEncontrado texto="Ese alumno no existe o se borró." />

  const nombrePorDefecto =
    modo === 'pegar' && parseo.titulo ? parseo.titulo : modo === 'copiar' && copiada ? copiada.rutina.nombre : `Rutina ${nombreMes(hoy())}`
  const nombreFinal = (nombre ?? nombrePorDefecto).trim()

  const diasPegados = parseo.dias
  const totalPegados = diasPegados.reduce((n, d) => n + d.ejercicios.length, 0)
  const puedeCrear = modo === 'vacia' || (modo === 'pegar' && totalPegados > 0) || (modo === 'copiar' && !!copiada)

  async function crear() {
    if (!alumno || !puedeCrear) return
    let dias: Dia[] = []
    if (modo === 'pegar') dias = diasDesdeTexto(diasPegados)
    if (modo === 'copiar' && copiada) dias = clonarDias(copiada.rutina.dias)
    setCreando(true)
    try {
      const id = await crearRutina(alumno.id, nombreFinal, dias)
      avisar('Rutina creada')
      // A mano: directo al editor en lugar de esta pantalla. Si no, se vuelve al alumno.
      if (modo === 'vacia') navigate(`/alumno/${alumno.id}/rutina/${id}`, { replace: true })
      else volver(`/alumno/${alumno.id}`)
    } catch (e) {
      avisarError(e)
      setCreando(false)
    }
  }

  async function pegarDelPortapapeles() {
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) setTexto(t)
      else avisar('No hay texto copiado', 'error')
    } catch {
      avisar('No se pudo leer lo copiado. Mantené apretado el cuadro y elegí Pegar.', 'error')
    }
  }

  return (
    <>
      <Encabezado titulo="Nueva rutina" subtitulo={alumno.nombre} volverA={`/alumno/${alumno.id}`} />
      <Pagina conBarraInferior>
        <div role="tablist" aria-label="Cómo cargar la rutina" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-sup-2 p-1">
          {(
            [
              ['pegar', 'Pegar texto'],
              ['copiar', 'Copiar otra'],
              ['vacia', 'A mano'],
            ] as const
          ).map(([m, etiqueta]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={cx('h-10 rounded-lg text-sm font-semibold', modo === m ? 'bg-sup text-texto shadow-sm' : 'text-texto-2')}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <Campo etiqueta="Nombre de la rutina">
          <input value={nombre ?? nombrePorDefecto} onChange={(e) => setNombre(e.target.value)} className={claseInput} />
        </Campo>

        {modo === 'pegar' && (
          <div className="mt-4">
            <div className="mb-1 flex items-end justify-between">
              <span className="text-sm font-medium text-texto-2">Rutina</span>
              {typeof navigator.clipboard?.readText === 'function' && (
                <button
                  type="button"
                  onClick={pegarDelPortapapeles}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-acento active:bg-acento-suave"
                >
                  <ClipboardPaste className="h-4 w-4" /> Pegar
                </button>
              )}
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={10}
              placeholder={EJEMPLO}
              aria-label="Texto de la rutina"
              className={cx(claseInput, 'leading-snug')}
            />
            <p className="mt-1 text-xs text-texto-3">
              Pegala como la mandás por WhatsApp: cada "Día" arma un día y cada renglón es un ejercicio. Después la podés corregir.
            </p>

            {texto.trim() && (
              <section className="mt-5">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-3">
                  Así queda: {diasPegados.length} {diasPegados.length === 1 ? 'día' : 'días'}, {totalPegados} ejercicios
                </h2>
                {totalPegados === 0 ? (
                  <p className="rounded-2xl bg-peligro-suave px-4 py-3 text-sm text-peligro">No se encontró ningún ejercicio en el texto.</p>
                ) : (
                  <VistaDias dias={diasPegados} />
                )}
              </section>
            )}
          </div>
        )}

        {modo === 'copiar' && (
          <div className="mt-4">
            {rutinasParaCopiar.length === 0 ? (
              <p className="rounded-2xl bg-sup-2 px-4 py-3 text-sm text-texto-2">Todavía no hay rutinas con ejercicios para copiar.</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-texto-2">Elegí la rutina a copiar. Se copian los días y ejercicios; lo anotado no.</p>
                <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-sup">
                  {rutinasParaCopiar.map((x) => (
                    <li key={x.clave}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-sup-2">
                        <input
                          type="radio"
                          name="origen"
                          checked={origen === x.clave}
                          onChange={() => setOrigen(x.clave)}
                          className="h-5 w-5 accent-[var(--acento)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{x.rutina.nombre}</span>
                          <span className="block truncate text-xs text-texto-3">
                            {x.esteAlumno ? 'De este alumno' : x.alumno} · {x.rutina.dias.length} {x.rutina.dias.length === 1 ? 'día' : 'días'} ·{' '}
                            {fechaCorta(x.rutina.creada)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {copiada && (
                  <div className="mt-4">
                    <VistaDias dias={copiada.rutina.dias} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {modo === 'vacia' && (
          <p className="mt-4 rounded-2xl bg-sup-2 px-4 py-3 text-sm text-texto-2">
            Se crea la rutina con un "Día 1" vacío y la vas completando ejercicio por ejercicio.
          </p>
        )}

        {alumno.rutinas.some((r) => r.activa) && (
          <p className="mt-4 text-xs text-texto-3">
            La rutina actual pasa a "Rutinas anteriores". Lo anotado se conserva y el progreso sigue sumando si el ejercicio se llama igual.
          </p>
        )}
      </Pagina>

      <BarraInferior>
        <Boton className="flex-1" disabled={!puedeCrear || !nombreFinal} cargando={creando} onClick={() => void crear()}>
          {modo === 'vacia' ? 'Crear y cargar ejercicios' : 'Crear rutina'}
        </Boton>
      </BarraInferior>
    </>
  )
}

function VistaDias({
  dias,
}: {
  dias: { nombre: string; ejercicios: { nombre: string; series: number; reps: string; descanso: string; indicaciones: string }[] }[]
}) {
  return (
    <div className="space-y-3">
      {dias.map((d, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-borde bg-sup">
          <p className="border-b border-borde bg-sup-2/60 px-4 py-2 font-semibold">{d.nombre}</p>
          <ol className="divide-y divide-borde">
            {d.ejercicios.map((e, j) => (
              <li key={j} className="px-4 py-2 text-sm">
                <p className="font-medium">{e.nombre}</p>
                <p className="text-texto-3">
                  <span className="font-medium text-acento">
                    {e.series} {e.reps ? `× ${e.reps}` : 'series'}
                  </span>
                  {e.descanso && ` · Descanso ${e.descanso}`}
                </p>
                {e.indicaciones && <p className="text-texto-2">{e.indicaciones}</p>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
