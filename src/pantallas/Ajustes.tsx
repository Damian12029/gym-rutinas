import { useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, RefreshCw, Share2, Smartphone, Upload } from 'lucide-react'
import { db, leerMeta } from '../lib/db'
import { META_ULTIMA_COPIA, archivoDeCopia, armarCopia, leerCopia, marcarCopiaHecha, restaurarCopia, type Copia } from '../lib/copia'
import { pedirPersistencia } from '../lib/datos'
import { avisar, avisarError } from '../lib/aviso'
import { esIOS, estaInstalada, instalar, usePuedeInstalar } from '../lib/instalar'
import { buscarActualizacion } from '../lib/actualizacion'
import { fechaISO, fechaLarga, haceCuanto } from '../lib/util'
import { Boton, Confirmar, Encabezado, Pagina } from '../componentes/ui'

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-3">{titulo}</h2>
      <div className="rounded-2xl border border-borde bg-sup p-4">{children}</div>
    </section>
  )
}

export default function Ajustes() {
  const estado = useLiveQuery(async () => {
    const [alumnos, registros, ultimaCopia] = await Promise.all([db.alumnos.count(), db.registros.count(), leerMeta(META_ULTIMA_COPIA)])
    const persistente = (await navigator.storage?.persisted?.()) ?? false
    return { alumnos, registros, ultimaCopia, persistente }
  })
  const puedeInstalar = usePuedeInstalar()
  const archivo = useRef<HTMLInputElement>(null)
  const [aRestaurar, setARestaurar] = useState<Copia | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  // persisted() no es un cambio en la base: la consulta viva no se entera sola.
  const [persistenteAhora, setPersistenteAhora] = useState(false)
  const persistente = persistenteAhora || !!estado?.persistente

  const puedeCompartir = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.txt', { type: 'text/plain' })] })

  async function compartir() {
    setTrabajando(true)
    try {
      const copia = archivoDeCopia(await armarCopia(), 'txt')
      await navigator.share({ files: [copia], title: 'Copia de Rutinas' })
      await marcarCopiaHecha()
      avisar('Copia compartida')
    } catch (e) {
      // Cerrar el menú de compartir no es un error. Si el navegador no deja compartir el archivo, se descarga.
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        await descargar()
        return
      }
      avisarError(e)
    } finally {
      setTrabajando(false)
    }
  }

  async function descargar() {
    setTrabajando(true)
    try {
      const copia = archivoDeCopia(await armarCopia())
      const url = URL.createObjectURL(copia)
      const a = document.createElement('a')
      a.href = url
      a.download = copia.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      await marcarCopiaHecha()
      avisar('Copia descargada')
    } catch (e) {
      avisarError(e)
    } finally {
      setTrabajando(false)
    }
  }

  async function elegirArchivo(f: File | undefined) {
    if (!f) return
    try {
      setARestaurar(leerCopia(await f.text()))
    } catch (e) {
      avisarError(e)
    } finally {
      if (archivo.current) archivo.current.value = ''
    }
  }

  const instalada = estaInstalada()

  return (
    <>
      <Encabezado titulo="Ajustes" volverA="/" />
      <Pagina>
        <Seccion titulo="Copia de seguridad">
          <p className="text-sm text-texto-2">
            Todo se guarda solo en este teléfono. Si se pierde o se borra el navegador, se pierde todo. Hacé una copia cada tanto y mandala a tu WhatsApp, Drive
            o mail.
          </p>
          <p className="mt-3 text-sm">
            Última copia:{' '}
            <span className="font-semibold">{estado?.ultimaCopia ? `${fechaLarga(estado.ultimaCopia)} (${haceCuanto(estado.ultimaCopia)})` : 'nunca'}</span>
          </p>
          <div className="mt-4 grid gap-2">
            {puedeCompartir && (
              <Boton onClick={() => void compartir()} cargando={trabajando}>
                <Share2 className="h-5 w-5" /> Guardar copia (WhatsApp, Drive...)
              </Boton>
            )}
            <Boton variante={puedeCompartir ? 'secundario' : 'primario'} onClick={() => void descargar()} disabled={trabajando}>
              <Download className="h-5 w-5" /> Descargar copia
            </Boton>
          </div>
        </Seccion>

        <Seccion titulo="Restaurar">
          <p className="text-sm text-texto-2">
            Para pasar los datos a otro teléfono o recuperarlos: elegí el archivo de la copia. Se suma a lo que ya hay; si algo está en los dos lados, queda lo
            más reciente.
          </p>
          <input
            ref={archivo}
            type="file"
            accept=".json,.txt,application/json,text/plain"
            className="hidden"
            onChange={(e) => void elegirArchivo(e.target.files?.[0])}
          />
          <Boton variante="secundario" className="mt-4 w-full" onClick={() => archivo.current?.click()}>
            <Upload className="h-5 w-5" /> Elegir archivo de copia
          </Boton>
        </Seccion>

        <Seccion titulo="Instalar en el teléfono">
          {instalada ? (
            <p className="text-sm text-texto-2">La app ya está instalada. Se abre desde el ícono y funciona sin internet.</p>
          ) : puedeInstalar ? (
            <>
              <p className="text-sm text-texto-2">Instalala para abrirla desde un ícono, a pantalla completa y sin internet.</p>
              <Boton className="mt-4 w-full" onClick={() => void instalar().catch(avisarError)}>
                <Smartphone className="h-5 w-5" /> Instalar app
              </Boton>
            </>
          ) : esIOS() ? (
            <p className="text-sm text-texto-2">
              En Safari tocá <span className="font-semibold">Compartir</span> (el cuadrado con la flecha; en iOS 26 está dentro del menú{' '}
              <span className="font-semibold">···</span> de la barra) y después <span className="font-semibold">Agregar a inicio</span>. Instalala antes de
              cargar datos: en iPhone la app instalada guarda sus datos aparte de Safari.
            </p>
          ) : (
            <p className="text-sm text-texto-2">
              Abrí el menú del navegador (los tres puntos) y elegí <span className="font-semibold">Instalar app</span> o{' '}
              <span className="font-semibold">Agregar a la pantalla principal</span>.
            </p>
          )}
        </Seccion>

        <Seccion titulo="Datos">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-texto-2">Alumnos</dt>
            <dd className="text-right font-semibold tabular-nums">{estado?.alumnos ?? '–'}</dd>
            <dt className="text-texto-2">Ejercicios anotados</dt>
            <dd className="text-right font-semibold tabular-nums">{estado?.registros ?? '–'}</dd>
            <dt className="text-texto-2">Protegidos de borrado automático</dt>
            <dd className="text-right font-semibold">{estado ? (persistente ? 'Sí' : 'No') : '–'}</dd>
          </dl>
          {estado && !persistente && (
            <Boton
              variante="secundario"
              className="mt-4 w-full text-sm"
              onClick={async () => {
                const ok = await pedirPersistencia(true)
                setPersistenteAhora(ok)
                avisar(ok ? 'Listo: el navegador no los va a borrar solo' : 'El navegador no lo permitió. Instalá la app y hacé copias.', ok ? 'ok' : 'error')
              }}
            >
              Pedir que no se borren
            </Boton>
          )}
        </Seccion>

        <Seccion titulo="Versión">
          <p className="text-sm text-texto-2">
            Instalada: <span className="font-semibold tabular-nums text-texto">{__VERSION__}</span>
          </p>
          <p className="mt-1 text-xs text-texto-3">Se actualiza sola al abrirla con internet. Si sabés que hay una nueva y no aparece, buscala acá.</p>
          <Boton
            variante="secundario"
            className="mt-4 w-full"
            cargando={buscando}
            onClick={async () => {
              setBuscando(true)
              try {
                // Si hay una nueva, la página se recarga sola al terminar de bajarla.
                if (!(await buscarActualizacion())) avisar('Ya tenés la última versión')
              } catch {
                avisar('No se pudo buscar: revisá la conexión a internet', 'error')
              } finally {
                setBuscando(false)
              }
            }}
          >
            <RefreshCw className="h-5 w-5" /> Buscar actualización
          </Boton>
        </Seccion>
      </Pagina>

      <Confirmar
        abierta={!!aRestaurar}
        titulo="¿Restaurar esta copia?"
        texto={
          aRestaurar && (
            <>
              La copia {aRestaurar.exportado && `del ${fechaLarga(fechaISO(new Date(aRestaurar.exportado)))} `}tiene {aRestaurar.alumnos.length}{' '}
              {aRestaurar.alumnos.length === 1 ? 'alumno' : 'alumnos'} y {aRestaurar.registros.length} ejercicios anotados. Se suma a lo que ya hay.
            </>
          )
        }
        accion="Restaurar"
        onCerrar={() => setARestaurar(null)}
        onConfirmar={async () => {
          if (!aRestaurar) return
          try {
            const r = await restaurarCopia(aRestaurar)
            const cambios = r.alumnosNuevos + r.alumnosActualizados + r.registrosNuevos + r.registrosActualizados
            avisar(
              cambios === 0
                ? 'No había nada nuevo en la copia'
                : `Listo: ${r.alumnosNuevos + r.alumnosActualizados} alumnos y ${r.registrosNuevos + r.registrosActualizados} anotaciones restauradas`,
            )
          } catch (e) {
            avisarError(e)
          }
        }}
      />
    </>
  )
}
