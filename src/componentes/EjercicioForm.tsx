import { useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import type { Ejercicio } from '../lib/tipos'
import { claveEjercicio } from '../lib/util'
import { Boton, Campo, claseInput, cx } from './ui'

const DESCANSOS = ['1 min', '1:30 min', '2 min', '1:30 a 2 min']

/** En iPhone la tecla del teclado enviaría el formulario desde el primer campo: pasa al siguiente. */
function pasarA(destino: RefObject<HTMLInputElement | null>) {
  return (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== 'Enter') return
    ev.preventDefault()
    destino.current?.focus()
  }
}

/** Formulario de alta/edición. Va dentro de una Hoja: se monta con los datos al abrirse. */
export default function EjercicioForm({
  inicial,
  esNuevo,
  posicion,
  total,
  onGuardar,
  onCancelar,
  onMover,
  onBorrar,
}: {
  inicial: Ejercicio
  esNuevo: boolean
  /** Lugar actual en el día (desde 1); cambia al moverlo con la hoja abierta. */
  posicion: number
  total: number
  onGuardar: (e: Ejercicio, opciones: { esOtro: boolean }) => Promise<void>
  onCancelar: () => void
  onMover: (delta: number) => void
  onBorrar: () => void
}) {
  const [e, setE] = useState(inicial)
  const [esOtro, setEsOtro] = useState<boolean | null>(null)
  const [guardando, setGuardando] = useState(false)
  const reps = useRef<HTMLInputElement>(null)
  const descanso = useRef<HTMLInputElement>(null)
  const cambiar = <K extends keyof Ejercicio>(k: K, v: Ejercicio[K]) => setE((x) => ({ ...x, [k]: v }))

  const anotados = useLiveQuery(() => (esNuevo ? 0 : db.registros.where('ejercicioId').equals(inicial.id).count()), [inicial.id, esNuevo])
  // Cambiarle el nombre a un ejercicio con historial puede ser corregir cómo se escribe
  // o reemplazarlo por otro: son cosas distintas para el progreso, así que se pregunta.
  const preguntar = !esNuevo && !!e.nombre.trim() && claveEjercicio(e.nombre) !== claveEjercicio(inicial.nombre) && (anotados ?? 0) > 0
  const falta = !e.nombre.trim() || (preguntar && esOtro === null)

  async function guardar() {
    if (falta) return
    setGuardando(true)
    try {
      await onGuardar(e, { esOtro: preguntar && esOtro === true })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault()
        void guardar()
      }}
      className="space-y-4"
    >
      <Campo etiqueta="Ejercicio">
        <input
          data-autofocus={esNuevo || undefined}
          value={e.nombre}
          onChange={(ev) => cambiar('nombre', ev.target.value)}
          onKeyDown={pasarA(reps)}
          enterKeyHint="next"
          placeholder="Press plano con barra"
          autoCapitalize="sentences"
          className={claseInput}
        />
      </Campo>

      {preguntar && (
        <fieldset className="rounded-xl border border-acento/40 bg-acento-suave p-3">
          <legend className="sr-only">¿Es el mismo ejercicio?</legend>
          <p className="text-sm font-medium">
            "{inicial.nombre}" tiene {anotados} {anotados === 1 ? 'día anotado' : 'días anotados'}. ¿Es el mismo ejercicio?
          </p>
          <label className="mt-2 flex items-start gap-2.5 py-1">
            <input
              type="radio"
              name="esOtro"
              checked={esOtro === false}
              onChange={() => setEsOtro(false)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--acento)]"
            />
            <span className="text-sm">
              <span className="font-semibold">Sí, corregí el nombre.</span> <span className="text-texto-2">Lo anotado pasa al nombre nuevo.</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 py-1">
            <input
              type="radio"
              name="esOtro"
              checked={esOtro === true}
              onChange={() => setEsOtro(true)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--acento)]"
            />
            <span className="text-sm">
              <span className="font-semibold">No, es otro ejercicio.</span>{' '}
              <span className="text-texto-2">Arranca de cero; lo anotado queda en Progreso como "{inicial.nombre}".</span>
            </span>
          </label>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Series" grupo>
          <div className="flex h-[50px] items-center rounded-xl border border-borde bg-sup">
            <button
              type="button"
              aria-label="Una serie menos"
              disabled={e.series <= 1}
              onClick={() => cambiar('series', e.series - 1)}
              className="flex h-full w-12 items-center justify-center text-texto-2 disabled:opacity-30"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="flex-1 text-center text-lg font-semibold tabular-nums" aria-live="polite">
              {e.series}
            </span>
            <button
              type="button"
              aria-label="Una serie más"
              disabled={e.series >= 10}
              onClick={() => cambiar('series', e.series + 1)}
              className="flex h-full w-12 items-center justify-center text-texto-2 disabled:opacity-30"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </Campo>
        <Campo etiqueta="Repeticiones">
          <input
            ref={reps}
            value={e.reps}
            onChange={(ev) => cambiar('reps', ev.target.value)}
            onKeyDown={pasarA(descanso)}
            enterKeyHint="next"
            placeholder="12 a 15"
            className={claseInput}
          />
        </Campo>
      </div>

      <Campo etiqueta="Descanso" grupo>
        <input
          ref={descanso}
          value={e.descanso}
          onChange={(ev) => cambiar('descanso', ev.target.value)}
          aria-label="Descanso"
          placeholder="1:30 min"
          className={claseInput}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {DESCANSOS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => cambiar('descanso', d)}
              className={cx(
                'h-9 rounded-full border px-3 text-sm',
                e.descanso === d ? 'border-acento bg-acento-suave font-semibold text-acento' : 'border-borde text-texto-2',
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </Campo>

      <Campo etiqueta="Indicaciones" ayuda="Calentamiento, técnica, biserie, altura de la polea...">
        <textarea value={e.indicaciones} onChange={(ev) => cambiar('indicaciones', ev.target.value)} rows={2} className={claseInput} />
      </Campo>

      <div className="flex gap-2">
        <Boton variante="secundario" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" className="flex-1" disabled={falta} cargando={guardando}>
          {esNuevo ? 'Agregar' : 'Guardar'}
        </Boton>
      </div>

      {!esNuevo && (
        <div className="border-t border-borde pt-3">
          <p className="mb-2 text-xs text-texto-3">
            Lugar {posicion} de {total} en el día. Subir y Bajar se aplican al instante.
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
      )}
    </form>
  )
}
