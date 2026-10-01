import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, ClipboardList, Pencil, Plus, TrendingUp } from 'lucide-react'
import { diaQueLeToca, ultimoRegistro, useAlumno, useRegistrosAlumno } from '../lib/consultas'
import { useHoy } from '../lib/hooks'
import { useSala } from '../lib/sala'
import { borrarAlumno, modificarAlumno } from '../lib/datos'
import { avisar, avisarError } from '../lib/aviso'
import type { Alumno } from '../lib/tipos'
import { fechaCorta, haceCuanto } from '../lib/util'
import { Boton, BotonIcono, Campo, Cargando, Confirmar, Encabezado, Hoja, NoEncontrado, Pagina, Vacio, claseInput, cx, useVolver } from '../componentes/ui'

export default function AlumnoPage() {
  const { alumnoId } = useParams()
  const alumno = useAlumno(alumnoId)
  const registros = useRegistrosAlumno(alumnoId)
  const [editando, setEditando] = useState(false)
  const hoyISO = useHoy()
  const sala = useSala()

  // Última fecha anotada de cada ejercicio, para mostrar cuándo se hizo cada día.
  const ultimaPorEjercicio = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const r of registros ?? []) {
      const actual = mapa.get(r.ejercicioId)
      if (!actual || r.fecha > actual) mapa.set(r.ejercicioId, r.fecha)
    }
    return mapa
  }, [registros])

  if (alumno === undefined) return <Cargando />
  if (alumno === null) return <NoEncontrado texto="Ese alumno no existe o se borró." />

  const activa = alumno.rutinas.find((r) => r.activa)
  const enSala = sala?.find((e) => e.alumnoId === alumno.id)
  const toca = activa && registros ? diaQueLeToca(activa, ultimoRegistro(registros), hoyISO, enSala) : undefined
  const anteriores = alumno.rutinas.filter((r) => !r.activa)

  return (
    <>
      <Encabezado
        titulo={alumno.nombre}
        volverA="/"
        acciones={
          <BotonIcono etiqueta="Editar alumno" onClick={() => setEditando(true)}>
            <Pencil className="h-5 w-5" />
          </BotonIcono>
        }
      />
      <Pagina>
        {alumno.notas && <p className="mb-4 whitespace-pre-line rounded-2xl bg-sup-2 px-4 py-3 text-sm text-texto-2">{alumno.notas}</p>}

        {activa ? (
          <section>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{activa.nombre}</h2>
                <p className="text-xs text-texto-3">Desde el {fechaCorta(activa.creada)}</p>
              </div>
              <Link
                to={`/alumno/${alumno.id}/rutina/${activa.id}`}
                className="flex h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-acento active:bg-acento-suave"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            </div>

            {activa.dias.length === 0 ? (
              <Vacio titulo="La rutina no tiene días" texto="Agregale días y ejercicios desde Editar." />
            ) : (
              <ul className="space-y-2">
                {activa.dias.map((d) => {
                  const ultima = d.ejercicios.reduce<string | undefined>((max, e) => {
                    const f = ultimaPorEjercicio.get(e.id)
                    return f && (!max || f > max) ? f : max
                  }, undefined)
                  const leToca = d.id === toca?.id
                  return (
                    <li key={d.id}>
                      <Link
                        to={`/alumno/${alumno.id}/dia/${activa.id}/${d.id}`}
                        className={cx(
                          'flex items-center gap-3 rounded-2xl border bg-sup px-4 py-4 active:bg-sup-2',
                          leToca ? 'border-acento/50 ring-1 ring-acento/30' : 'border-borde',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          {leToca && (
                            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-acento">
                              {enSala?.diaId === d.id ? 'Entrenando ahora' : 'Le toca hoy'}
                            </p>
                          )}
                          <p className="truncate text-lg font-semibold">{d.nombre}</p>
                          <p className="truncate text-sm text-texto-3">
                            {d.ejercicios.length} {d.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}
                            {ultima && ` · ${haceCuanto(ultima)}`}
                          </p>
                        </div>
                        <span
                          className={cx(
                            'flex h-10 items-center rounded-full px-4 text-sm font-semibold',
                            leToca ? 'bg-acento-boton text-sobre-acento' : 'bg-acento-suave text-acento',
                          )}
                        >
                          Anotar
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : (
          <Vacio
            titulo={anteriores.length ? 'No tiene una rutina activa' : 'Todavía no tiene rutina'}
            texto={anteriores.length ? 'Creá una nueva o volvé a usar una anterior.' : 'Pegá la rutina como la escribís en WhatsApp o cargala a mano.'}
          >
            <Link
              to={`/alumno/${alumno.id}/nueva-rutina`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-acento-boton px-4 font-semibold text-sobre-acento active:bg-acento-fuerte"
            >
              <Plus className="h-5 w-5" /> Crear rutina
            </Link>
          </Vacio>
        )}

        {/* Sin rutina activa, "Crear rutina" ya está arriba. Progreso sigue a mano si quedó algo anotado. */}
        {(activa || anteriores.length > 0 || (registros?.length ?? 0) > 0) && (
          <div className={cx('mt-4 grid gap-2', activa && 'grid-cols-2')}>
            <Link
              to={`/alumno/${alumno.id}/progreso`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-sup-2 font-semibold active:brightness-95"
            >
              <TrendingUp className="h-5 w-5 text-acento" /> Progreso
            </Link>
            {activa && (
              <Link
                to={`/alumno/${alumno.id}/nueva-rutina`}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-sup-2 font-semibold active:brightness-95"
              >
                <Plus className="h-5 w-5 text-acento" /> Nueva rutina
              </Link>
            )}
          </div>
        )}

        {anteriores.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-3">Rutinas anteriores</h2>
            <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-sup">
              {anteriores.map((r) => (
                <li key={r.id}>
                  <Link to={`/alumno/${alumno.id}/rutina/${r.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-sup-2">
                    <ClipboardList className="h-5 w-5 shrink-0 text-texto-3" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.nombre}</p>
                      <p className="text-xs text-texto-3">
                        Creada el {fechaCorta(r.creada)} · {r.dias.length} {r.dias.length === 1 ? 'día' : 'días'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-texto-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Pagina>

      <EditarAlumno alumno={alumno} abierto={editando} onCerrar={() => setEditando(false)} />
    </>
  )
}

function EditarAlumno({ alumno, abierto, onCerrar }: { alumno: Alumno; abierto: boolean; onCerrar: () => void }) {
  const volver = useVolver()
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  return (
    <>
      <Hoja abierta={abierto} onCerrar={onCerrar} titulo="Editar alumno">
        <FormAlumno
          alumno={alumno}
          onCerrar={onCerrar}
          onBorrar={() => {
            onCerrar()
            setConfirmarBorrado(true)
          }}
        />
      </Hoja>

      <Confirmar
        abierta={confirmarBorrado}
        titulo={`¿Borrar a ${alumno.nombre}?`}
        texto="Se borran sus rutinas y todo lo anotado. No se puede deshacer (salvo que restaures una copia de seguridad)."
        accion="Borrar"
        onCerrar={() => setConfirmarBorrado(false)}
        onConfirmar={async () => {
          try {
            await borrarAlumno(alumno.id)
            avisar('Alumno borrado')
            volver('/')
          } catch (e) {
            avisarError(e)
          }
        }}
      />
    </>
  )
}

// La Hoja monta el contenido al abrirse, así el formulario arranca con los datos actuales.
function FormAlumno({ alumno, onCerrar, onBorrar }: { alumno: Alumno; onCerrar: () => void; onBorrar: () => void }) {
  const [nombre, setNombre] = useState(alumno.nombre)
  const [notas, setNotas] = useState(alumno.notas)

  async function guardar() {
    if (!nombre.trim()) return
    try {
      await modificarAlumno(alumno.id, (a) => {
        a.nombre = nombre.trim()
        a.notas = notas.trim()
      })
      onCerrar()
    } catch (e) {
      avisarError(e)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void guardar()
      }}
      className="space-y-4"
    >
      <Campo etiqueta="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoCapitalize="words" className={claseInput} />
      </Campo>
      <Campo etiqueta="Notas" ayuda="Lesiones, objetivos, lo que haga falta recordar.">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={claseInput} />
      </Campo>
      <div className="flex gap-2">
        <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" className="flex-1" disabled={!nombre.trim()}>
          Guardar
        </Boton>
      </div>
      <Boton variante="fantasma" className="w-full text-peligro active:bg-peligro-suave" onClick={onBorrar}>
        Borrar alumno
      </Boton>
    </form>
  )
}
