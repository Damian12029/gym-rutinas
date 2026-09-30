import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronRight, ClipboardPaste, Pencil, Plus, Trash2 } from 'lucide-react'
import EjercicioForm from '../componentes/EjercicioForm'
import { useAlumno } from '../lib/consultas'
import {
  activarRutina,
  agregarDia,
  borrarDia,
  borrarEjercicio,
  borrarRutina,
  diasDesdeTexto,
  ejercicioVacio,
  guardarEjercicio,
  modificarDia,
  modificarRutina,
  moverDia,
  moverEjercicio,
} from '../lib/datos'
import { parsearRutina } from '../lib/parser'
import { avisar, avisarError } from '../lib/aviso'
import type { Dia, Ejercicio, Rutina } from '../lib/tipos'
import { fechaCorta } from '../lib/util'
import { Boton, Campo, Cargando, Confirmar, Encabezado, Hoja, NoEncontrado, Pagina, claseInput, useVolver } from '../componentes/ui'

type EdicionEjercicio = { diaId: string; ejercicio: Ejercicio; esNuevo: boolean }

export default function RutinaEditor() {
  const { alumnoId, rutinaId } = useParams()
  const volver = useVolver()
  const alumno = useAlumno(alumnoId)
  const [edicion, setEdicion] = useState<EdicionEjercicio | null>(null)
  const [diaEditado, setDiaEditado] = useState<string | null>(null)
  const [pegarEn, setPegarEn] = useState<string | null>(null)
  const [borrarEj, setBorrarEj] = useState<{ diaId: string; ejercicio: Ejercicio } | null>(null)
  const [borrarDiaSel, setBorrarDiaSel] = useState<Dia | null>(null)
  const [borrarRut, setBorrarRut] = useState(false)

  if (alumno === undefined) return <Cargando />
  const rutina = alumno?.rutinas.find((r) => r.id === rutinaId)
  if (!alumno || !rutina) return <NoEncontrado texto="Esa rutina no existe o se borró." volverA={alumno ? `/alumno/${alumno.id}` : '/'} />

  const aId = alumno.id
  const rId = rutina.id
  const correr = (p: Promise<unknown>): Promise<void> => p.then(() => undefined, avisarError)

  // Posición actual del ejercicio en edición (cambia al moverlo con la hoja abierta).
  const diaDeEdicion = edicion ? rutina.dias.find((d) => d.id === edicion.diaId) : undefined
  const posEdicion = edicion && diaDeEdicion ? diaDeEdicion.ejercicios.findIndex((e) => e.id === edicion.ejercicio.id) : -1

  return (
    <>
      <Encabezado titulo="Editar rutina" subtitulo={alumno.nombre} volverA={`/alumno/${aId}`} />
      <Pagina>
        {!rutina.activa && (
          <div className="mb-4 rounded-2xl bg-acento-suave px-4 py-3">
            <p className="text-sm">Esta rutina no es la que usa ahora {alumno.nombre}.</p>
            <Boton
              className="mt-2 w-full"
              onClick={() =>
                correr(
                  activarRutina(aId, rId).then(() => {
                    avisar('Rutina activada')
                    volver(`/alumno/${aId}`)
                  }),
                )
              }
            >
              Usar esta rutina
            </Boton>
          </div>
        )}

        <NombreRutina key={rId} rutina={rutina} alumnoId={aId} />
        <p className="mt-1 text-xs text-texto-3">Creada el {fechaCorta(rutina.creada)}</p>

        <div className="mt-5 space-y-4">
          {rutina.dias.map((d) => (
            <section key={d.id} className="overflow-hidden rounded-2xl border border-borde bg-sup">
              <button
                type="button"
                onClick={() => setDiaEditado(d.id)}
                className="flex w-full items-center gap-2 border-b border-borde bg-sup-2/60 px-4 py-3 text-left active:bg-sup-2"
              >
                <span className="flex-1 text-base font-semibold">{d.nombre}</span>
                <Pencil className="h-4 w-4 text-texto-3" />
              </button>
              {d.ejercicios.length > 0 && (
                <ol className="divide-y divide-borde">
                  {d.ejercicios.map((e, i) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setEdicion({ diaId: d.id, ejercicio: e, esNuevo: false })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sup-2"
                      >
                        <span className="w-5 shrink-0 text-sm font-semibold text-texto-3">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-medium">{e.nombre}</span>
                          <span className="block truncate text-sm text-texto-3">
                            {e.series} {e.reps ? `× ${e.reps}` : 'series'}
                            {e.descanso && ` · ${e.descanso}`}
                            {e.indicaciones && ` · ${e.indicaciones}`}
                          </span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-texto-3" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex border-t border-borde">
                <button
                  type="button"
                  onClick={() => setEdicion({ diaId: d.id, ejercicio: ejercicioVacio(), esNuevo: true })}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-acento active:bg-acento-suave"
                >
                  <Plus className="h-4 w-4" /> Ejercicio
                </button>
                <button
                  type="button"
                  onClick={() => setPegarEn(d.id)}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 border-l border-borde text-sm font-semibold text-acento active:bg-acento-suave"
                >
                  <ClipboardPaste className="h-4 w-4" /> Pegar varios
                </button>
              </div>
            </section>
          ))}
        </div>

        <Boton variante="secundario" className="mt-4 w-full" onClick={() => correr(agregarDia(aId, rId))}>
          <Plus className="h-5 w-5" /> Agregar día
        </Boton>

        <Boton variante="fantasma" className="mt-8 w-full text-peligro active:bg-peligro-suave" onClick={() => setBorrarRut(true)}>
          <Trash2 className="h-4 w-4" /> Borrar rutina
        </Boton>
      </Pagina>

      <Hoja abierta={!!edicion} onCerrar={() => setEdicion(null)} titulo={edicion?.esNuevo ? 'Nuevo ejercicio' : 'Editar ejercicio'}>
        {edicion && (
          <EjercicioForm
            key={edicion.ejercicio.id}
            inicial={edicion.ejercicio}
            esNuevo={edicion.esNuevo}
            posicion={posEdicion + 1}
            total={diaDeEdicion?.ejercicios.length ?? 0}
            onCancelar={() => setEdicion(null)}
            onGuardar={async (e, opciones) => {
              try {
                await guardarEjercicio(aId, rId, edicion.diaId, e, opciones)
                setEdicion(null)
              } catch (err) {
                avisarError(err)
              }
            }}
            onMover={(delta) => correr(moverEjercicio(aId, rId, edicion.diaId, edicion.ejercicio.id, delta))}
            onBorrar={() => {
              setBorrarEj({ diaId: edicion.diaId, ejercicio: edicion.ejercicio })
              setEdicion(null)
            }}
          />
        )}
      </Hoja>

      <HojaDia
        rutina={rutina}
        diaId={diaEditado}
        onCerrar={() => setDiaEditado(null)}
        onRenombrar={(diaId, nombre) => correr(modificarDia(aId, rId, diaId, (d) => (d.nombre = nombre)))}
        onMover={(diaId, delta) => correr(moverDia(aId, rId, diaId, delta))}
        onBorrar={(dia) => {
          setDiaEditado(null)
          setBorrarDiaSel(dia)
        }}
      />

      <Hoja abierta={!!pegarEn} onCerrar={() => setPegarEn(null)} titulo="Pegar ejercicios">
        {pegarEn && (
          <PegarEjercicios
            onCancelar={() => setPegarEn(null)}
            onAgregar={async (ejercicios) => {
              try {
                await modificarDia(aId, rId, pegarEn, (d) => d.ejercicios.push(...ejercicios))
                avisar(`${ejercicios.length} ${ejercicios.length === 1 ? 'ejercicio agregado' : 'ejercicios agregados'}`)
                setPegarEn(null)
              } catch (err) {
                avisarError(err)
              }
            }}
          />
        )}
      </Hoja>

      <Confirmar
        abierta={!!borrarEj}
        titulo={`¿Borrar ${borrarEj?.ejercicio.nombre ?? 'el ejercicio'}?`}
        texto="Lo que ya anotaste de este ejercicio se conserva en Progreso."
        accion="Borrar"
        onCerrar={() => setBorrarEj(null)}
        onConfirmar={() => (borrarEj ? correr(borrarEjercicio(aId, rId, borrarEj.diaId, borrarEj.ejercicio.id)) : undefined)}
      />

      <Confirmar
        abierta={!!borrarDiaSel}
        titulo={`¿Borrar ${borrarDiaSel?.nombre ?? 'el día'}?`}
        texto={textoBorrarDia(borrarDiaSel?.ejercicios.length ?? 0)}
        accion="Borrar día"
        onCerrar={() => setBorrarDiaSel(null)}
        onConfirmar={() => (borrarDiaSel ? correr(borrarDia(aId, rId, borrarDiaSel.id)) : undefined)}
      />

      <Confirmar
        abierta={borrarRut}
        titulo={`¿Borrar la rutina "${rutina.nombre}"?`}
        texto="Se borra la rutina. Lo ya anotado se conserva en Progreso."
        accion="Borrar rutina"
        onCerrar={() => setBorrarRut(false)}
        onConfirmar={async () => {
          try {
            await borrarRutina(aId, rId)
            avisar('Rutina borrada')
            volver(`/alumno/${aId}`)
          } catch (err) {
            avisarError(err)
          }
        }}
      />
    </>
  )
}

function textoBorrarDia(n: number): string {
  if (n === 0) return 'El día está vacío.'
  const cuales = n === 1 ? 'Se saca su ejercicio' : `Se sacan sus ${n} ejercicios`
  return `${cuales} de la rutina. Lo ya anotado se conserva en Progreso.`
}

/**
 * Se guarda con cada tecla, como los pesos: con el atrás del teléfono el campo se
 * desmonta sin perder el foco y un guardado en onBlur nunca llegaría.
 */
function NombreRutina({ rutina, alumnoId }: { rutina: Rutina; alumnoId: string }) {
  const [nombre, setNombre] = useState(rutina.nombre)
  return (
    <Campo etiqueta="Nombre de la rutina">
      <input
        value={nombre}
        onChange={(e) => {
          const valor = e.target.value
          setNombre(valor)
          const limpio = valor.trim()
          if (limpio) modificarRutina(alumnoId, rutina.id, (r) => (r.nombre = limpio)).catch(avisarError)
        }}
        onBlur={() => {
          if (!nombre.trim()) setNombre(rutina.nombre)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        enterKeyHint="done"
        className={claseInput}
      />
    </Campo>
  )
}

function HojaDia({
  rutina,
  diaId,
  onCerrar,
  onRenombrar,
  onMover,
  onBorrar,
}: {
  rutina: Rutina
  diaId: string | null
  onCerrar: () => void
  onRenombrar: (diaId: string, nombre: string) => void
  onMover: (diaId: string, delta: number) => void
  onBorrar: (dia: Dia) => void
}) {
  const pos = rutina.dias.findIndex((d) => d.id === diaId)
  const dia = pos >= 0 ? rutina.dias[pos] : undefined
  return (
    <Hoja abierta={!!dia} onCerrar={onCerrar} titulo="Día">
      {dia && (
        <FormDia
          key={dia.id}
          dia={dia}
          posicion={pos + 1}
          total={rutina.dias.length}
          onGuardar={(nombre) => {
            onRenombrar(dia.id, nombre)
            onCerrar()
          }}
          onCancelar={onCerrar}
          onMover={(delta) => onMover(dia.id, delta)}
          onBorrar={() => onBorrar(dia)}
        />
      )}
    </Hoja>
  )
}

function FormDia({
  dia,
  posicion,
  total,
  onGuardar,
  onCancelar,
  onMover,
  onBorrar,
}: {
  dia: Dia
  posicion: number
  total: number
  onGuardar: (nombre: string) => void
  onCancelar: () => void
  onMover: (delta: number) => void
  onBorrar: () => void
}) {
  const [nombre, setNombre] = useState(dia.nombre)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim()) onGuardar(nombre.trim())
      }}
      className="space-y-4"
    >
      <Campo etiqueta="Nombre" ayuda='Por ejemplo "Día 1 - Pecho y bíceps" o "Lunes".'>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseInput} />
      </Campo>
      <div className="flex gap-2">
        <Boton variante="secundario" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" className="flex-1" disabled={!nombre.trim()}>
          Guardar
        </Boton>
      </div>
      <div className="border-t border-borde pt-3">
        <p className="mb-2 text-xs text-texto-3">
          Día {posicion} de {total} en la rutina. Subir y Bajar se aplican al instante.
        </p>
        <div className="flex items-center gap-2">
          <Boton variante="secundario" className="h-11 flex-1 text-sm" disabled={posicion <= 1} onClick={() => onMover(-1)}>
            <ArrowUp className="h-4 w-4" /> Subir
          </Boton>
          <Boton variante="secundario" className="h-11 flex-1 text-sm" disabled={posicion >= total} onClick={() => onMover(1)}>
            <ArrowDown className="h-4 w-4" /> Bajar
          </Boton>
          <Boton variante="peligro" className="h-11 flex-1 text-sm" onClick={onBorrar}>
            <Trash2 className="h-4 w-4" /> Borrar
          </Boton>
        </div>
      </div>
    </form>
  )
}

function PegarEjercicios({ onCancelar, onAgregar }: { onCancelar: () => void; onAgregar: (e: Ejercicio[]) => Promise<void> }) {
  const [texto, setTexto] = useState('')
  // Un doble toque en Agregar metería los mismos ejercicios (con los mismos ids) dos veces.
  const [agregando, setAgregando] = useState(false)
  const ejercicios = useMemo(() => diasDesdeTexto(parsearRutina(texto).dias).flatMap((d) => d.ejercicios), [texto])
  return (
    <div className="space-y-4">
      <textarea
        data-autofocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        placeholder={'Un ejercicio por renglón, por ejemplo:\nCurl con barra 3 x 12. Descanso 1:30 min.'}
        aria-label="Ejercicios"
        className={claseInput}
      />
      {ejercicios.length > 0 && (
        <ul className="space-y-1 text-sm">
          {ejercicios.map((e) => (
            <li key={e.id}>
              <span className="font-medium">{e.nombre}</span>{' '}
              <span className="text-texto-3">
                {e.series} {e.reps ? `× ${e.reps}` : 'series'}
                {e.descanso && ` · ${e.descanso}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Boton variante="secundario" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton
          className="flex-1"
          disabled={!ejercicios.length}
          cargando={agregando}
          onClick={async () => {
            if (agregando) return
            setAgregando(true)
            try {
              await onAgregar(ejercicios)
            } finally {
              setAgregando(false)
            }
          }}
        >
          Agregar {ejercicios.length || ''}
        </Boton>
      </div>
    </div>
  )
}
