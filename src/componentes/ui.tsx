import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useAviso } from '../lib/aviso'
import { distanciaHasta } from '../lib/navegacion'

export function cx(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(' ')
}

// ---------- Navegación ----------

/**
 * "Atrás" como el botón del teléfono: vuelve en el historial si se llegó navegando
 * dentro de la app; si se abrió directo en esta pantalla, va a `destino`.
 */
export function useVolver(): (destino: string) => void {
  const navigate = useNavigate()
  const location = useLocation()
  return (destino) => {
    if (location.key !== 'default') navigate(-1)
    else navigate(destino, { replace: true })
  }
}

/** Sube hasta `destino` si está más abajo en la pila (sin apilar pantallas); si no, la reemplaza. */
export function useIrA(): (destino: string) => void {
  const navigate = useNavigate()
  return (destino) => {
    const n = distanciaHasta(destino)
    if (n > 0) navigate(-n)
    else navigate(destino, { replace: true })
  }
}

// ---------- Encabezado ----------

export function Encabezado({
  titulo,
  subtitulo,
  volverA,
  onVolver,
  acciones,
  debajo,
}: {
  titulo: string
  subtitulo?: string
  /** Ruta de "atrás". Sin ruta no hay botón. */
  volverA?: string
  /** Reemplaza el "atrás" común cuando la pantalla necesita otro criterio. */
  onVolver?: () => void
  acciones?: ReactNode
  /** Contenido fijo debajo del título (queda pegado arriba al hacer scroll). */
  debajo?: ReactNode
}) {
  const volver = useVolver()
  return (
    <header className="pt-seguro sticky top-0 z-20 border-b border-borde bg-sup/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-1 px-2">
        {volverA !== undefined || onVolver ? (
          <button
            type="button"
            aria-label="Volver"
            onClick={() => (onVolver ? onVolver() : volver(volverA ?? '/'))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-texto-2 active:bg-sup-2"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <div className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{titulo}</h1>
          {subtitulo && <p className="truncate text-xs text-texto-3">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex shrink-0 items-center">{acciones}</div>}
      </div>
      {debajo && <div className="mx-auto max-w-xl">{debajo}</div>}
    </header>
  )
}

export function Pagina({ children, conBarraInferior }: { children: ReactNode; conBarraInferior?: boolean }) {
  return <main className={cx('mx-auto max-w-xl px-4 pt-4', conBarraInferior ? 'pb-28' : 'pb-seguro')}>{children}</main>
}

/** Botón fijo abajo, a mano del pulgar. */
export function BarraInferior({ children }: { children: ReactNode }) {
  return (
    <div className="pb-seguro fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-sup/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl gap-2 px-4 pt-3">{children}</div>
    </div>
  )
}

// ---------- Botones ----------

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-acento-boton text-sobre-acento active:bg-acento-fuerte',
  secundario: 'bg-sup-2 text-texto active:brightness-95',
  fantasma: 'text-acento active:bg-acento-suave',
  peligro: 'bg-peligro-suave text-peligro active:brightness-95',
}

export function Boton({
  variante = 'primario',
  cargando,
  className,
  children,
  disabled,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || cargando}
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors disabled:opacity-50',
        VARIANTES[variante],
        className,
      )}
      {...resto}
    >
      {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function BotonIcono({ etiqueta, className, children, ...resto }: ButtonHTMLAttributes<HTMLButtonElement> & { etiqueta: string }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={cx('flex h-11 w-11 items-center justify-center rounded-full text-texto-2 active:bg-sup-2 disabled:opacity-30', className)}
      {...resto}
    >
      {children}
    </button>
  )
}

// ---------- Campos ----------

export function Campo({
  etiqueta,
  children,
  ayuda,
  grupo,
}: {
  etiqueta: string
  children: ReactNode
  ayuda?: string
  /** Para campos con botones propios: un <label> reenviaría cualquier toque suelto al primer botón. */
  grupo?: boolean
}) {
  const id = useId()
  const contenido = (
    <>
      <span id={id} className="mb-1 block text-sm font-medium text-texto-2">
        {etiqueta}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-texto-3">{ayuda}</span>}
    </>
  )
  return grupo ? (
    <div role="group" aria-labelledby={id}>
      {contenido}
    </div>
  ) : (
    <label className="block">{contenido}</label>
  )
}

export const claseInput =
  'block w-full rounded-xl border border-borde bg-sup px-3 py-3 text-texto placeholder:text-texto-3 outline-none focus:border-acento focus:ring-2 focus:ring-acento/25'

// ---------- Hoja (diálogo) ----------

/**
 * Diálogo nativo arriba de la pantalla: el teclado del celular sale de abajo y
 * así nunca tapa los campos.
 */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  children,
  cerrarAlTocarFuera = false,
}: {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
  /** Solo para diálogos sin nada escrito: en iPhone tocar afuera es el gesto para esconder el teclado. */
  cerrarAlTocarFuera?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const contenido = useRef<HTMLDivElement>(null)
  const onCerrarRef = useRef(onCerrar)
  onCerrarRef.current = onCerrar

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierta && !d.open) {
      d.showModal()
      // showModal enfoca el primer campo y en el celular abre el teclado aunque solo se
      // quiera mover o borrar. Solo lo abre un campo marcado con data-autofocus.
      const destino = d.querySelector<HTMLElement>('[data-autofocus]') ?? contenido.current
      destino?.focus({ preventScroll: true })
    }
    if (!abierta && d.open) d.close()
  }, [abierta])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const alCerrar = () => onCerrarRef.current()
    d.addEventListener('close', alCerrar)
    return () => d.removeEventListener('close', alCerrar)
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={titulo}
      onClick={(e) => {
        if (cerrarAlTocarFuera && e.target === ref.current) ref.current.close()
      }}
      className="mx-auto mt-[max(1rem,env(safe-area-inset-top))] w-[calc(100%-1.5rem)] max-w-lg rounded-2xl bg-sup p-0 text-texto shadow-xl"
    >
      {abierta && (
        <div ref={contenido} tabIndex={-1} className="max-h-[85dvh] overflow-y-auto p-4 outline-none">
          <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function Confirmar({
  abierta,
  titulo,
  texto,
  accion,
  onConfirmar,
  onCerrar,
}: {
  abierta: boolean
  titulo: string
  texto: ReactNode
  accion: string
  onConfirmar: () => void | Promise<void>
  onCerrar: () => void
}) {
  // Restaurar o borrar mucho puede tardar: sin esto, un segundo toque repite la acción.
  const [ocupado, setOcupado] = useState(false)
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={titulo} cerrarAlTocarFuera={!ocupado}>
      <div className="mb-5 text-texto-2">{texto}</div>
      <div className="flex gap-2">
        <Boton variante="secundario" className="flex-1" disabled={ocupado} onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton
          variante="peligro"
          className="flex-1"
          cargando={ocupado}
          onClick={async () => {
            if (ocupado) return
            setOcupado(true)
            try {
              await onConfirmar()
              onCerrar()
            } finally {
              setOcupado(false)
            }
          }}
        >
          {accion}
        </Boton>
      </div>
    </Hoja>
  )
}

// ---------- Estados ----------

export function Vacio({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-borde px-6 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="mt-1 text-sm text-texto-2">{texto}</p>}
      {children && <div className="mt-5 flex justify-center">{children}</div>}
    </div>
  )
}

export function Cargando() {
  return (
    <div className="mx-auto max-w-xl space-y-3 px-4 pt-20" aria-busy="true" aria-label="Cargando">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-sup-2" />
      ))}
    </div>
  )
}

export function NoEncontrado({ texto, volverA = '/' }: { texto: string; volverA?: string }) {
  return (
    <>
      <Encabezado titulo="No encontrado" volverA={volverA} />
      <Pagina>
        <Vacio titulo={texto} />
      </Pagina>
    </>
  )
}

export function Avisos() {
  const aviso = useAviso()
  if (!aviso) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div
        key={aviso.id}
        className={cx(
          'max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
          aviso.tipo === 'error' ? 'bg-peligro-aviso text-white' : 'bg-texto text-fondo',
        )}
      >
        {aviso.texto}
      </div>
    </div>
  )
}
