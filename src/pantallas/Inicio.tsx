import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus, Search, Settings, ShieldAlert, Smartphone, X } from 'lucide-react'
import { crearAlumno } from '../lib/datos'
import { diaQueLeToca, useAlumnos, useUltimosRegistros } from '../lib/consultas'
import { useHoy } from '../lib/hooks'
import { rutaSesion } from '../lib/sala'
import { EntrenandoAhora } from '../componentes/Sala'
import { db, leerMeta } from '../lib/db'
import { META_ULTIMA_COPIA } from '../lib/copia'
import { avisarError } from '../lib/aviso'
import { recargarSiSeguro } from '../lib/actualizacion'
import { esIOS, estaInstalada, instalar, usePuedeInstalar } from '../lib/instalar'
import { claveEjercicio, diasEntre, haceCuanto, hoy } from '../lib/util'
import { BarraInferior, Boton, Cargando, Encabezado, Hoja, Pagina, Vacio, claseInput } from '../componentes/ui'

const DIAS_ENTRE_COPIAS = 7

export default function Inicio() {
  const alumnos = useAlumnos()
  const ultimos = useUltimosRegistros()
  const hoyISO = useHoy()
  const [busqueda, setBusqueda] = useState('')
  const [nuevoAbierto, setNuevoAbierto] = useState(false)

  // Si hay una versión nueva esperando, este es el momento seguro para cargarla.
  useEffect(() => {
    recargarSiSeguro()
  }, [])

  const filtrados = useMemo(() => {
    const q = claveEjercicio(busqueda)
    if (!alumnos || !q) return alumnos
    return alumnos.filter((a) => claveEjercicio(a.nombre).includes(q))
  }, [alumnos, busqueda])

  if (!alumnos || !filtrados) return <Cargando />

  return (
    <>
      <Encabezado
        titulo="Alumnos"
        acciones={
          <Link
            to="/ajustes"
            aria-label="Ajustes y copia de seguridad"
            className="flex h-11 w-11 items-center justify-center rounded-full text-texto-2 active:bg-sup-2"
          >
            <Settings className="h-5 w-5" />
          </Link>
        }
      />
      <Pagina conBarraInferior>
        <SugerenciaInstalar hayAlumnos={alumnos.length > 0} />
        <AvisoCopia />
        <EntrenandoAhora />

        {alumnos.length === 0 ? (
          <>
            <Vacio titulo="Todavía no hay alumnos" texto="Cargá el primero y después armale la rutina.">
              <Boton onClick={() => setNuevoAbierto(true)}>
                <Plus className="h-5 w-5" /> Agregar alumno
              </Boton>
            </Vacio>
            <Link to="/ajustes" className="mt-3 block rounded-xl px-2 py-3 text-center text-sm font-semibold text-acento active:bg-acento-suave">
              ¿Ya tenías alumnos cargados? Restaurá la copia de seguridad
            </Link>
          </>
        ) : (
          <>
            {alumnos.length > 5 && (
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
            {filtrados.length === 0 ? (
              <p className="py-8 text-center text-texto-2">Ningún alumno coincide con "{busqueda}".</p>
            ) : (
              <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-sup">
                {filtrados.map((a) => {
                  const activa = a.rutinas.find((r) => r.activa)
                  const ultimo = ultimos?.get(a.id)
                  const toca = activa && ultimos ? diaQueLeToca(activa, ultimo, hoyISO) : undefined
                  return (
                    <li key={a.id} className="flex items-center">
                      <Link to={`/alumno/${a.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 active:bg-sup-2">
                        <Inicial nombre={a.nombre} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">{a.nombre}</p>
                          <p className="truncate text-sm text-texto-3">
                            {activa ? activa.nombre : 'Sin rutina'}
                            {ultimo && ` · vino ${haceCuanto(ultimo.fecha)}`}
                          </p>
                        </div>
                        {!(activa && toca) && <ChevronRight className="h-5 w-5 shrink-0 text-texto-3" />}
                      </Link>
                      {/* Atajo al día que le toca: el alumno llega y se empieza a anotar con un toque. */}
                      {activa && toca && (
                        <Link
                          to={rutaSesion(a.id, activa.id, toca.id)}
                          state={{ sala: true }}
                          aria-label={`Anotar ${toca.nombre} de ${a.nombre}`}
                          className="mr-3 flex h-10 max-w-[8rem] shrink-0 items-center rounded-full bg-acento-suave px-3.5 text-sm font-semibold text-acento active:brightness-95"
                        >
                          <span className="truncate">{toca.nombre}</span>
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </Pagina>

      {alumnos.length > 0 && (
        <BarraInferior>
          <Boton className="flex-1" onClick={() => setNuevoAbierto(true)}>
            <Plus className="h-5 w-5" /> Agregar alumno
          </Boton>
        </BarraInferior>
      )}

      <NuevoAlumno abierto={nuevoAbierto} onCerrar={() => setNuevoAbierto(false)} />
    </>
  )
}

function Inicial({ nombre }: { nombre: string }) {
  const letras = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acento-suave text-sm font-bold text-acento">
      {letras || '?'}
    </span>
  )
}

function NuevoAlumno({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      const id = await crearAlumno(nombre)
      onCerrar()
      navigate(`/alumno/${id}`)
    } catch (e) {
      avisarError(e)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja abierta={abierto} onCerrar={onCerrar} titulo="Nuevo alumno">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
      >
        <input
          data-autofocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellido"
          aria-label="Nombre y apellido"
          autoCapitalize="words"
          enterKeyHint="done"
          className={claseInput}
        />
        <div className="mt-4 flex gap-2">
          <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" className="flex-1" disabled={!nombre.trim()} cargando={guardando}>
            Agregar
          </Boton>
        </div>
      </form>
    </Hoja>
  )
}

/** Los datos viven solo en este teléfono: recordar la copia cada tanto. */
function AvisoCopia() {
  const estado = useLiveQuery(async () => {
    const [ultima, registros] = await Promise.all([leerMeta(META_ULTIMA_COPIA), db.registros.count()])
    return { ultima, registros }
  })
  if (!estado || estado.registros === 0) return null
  if (estado.ultima && diasEntre(estado.ultima, hoy()) < DIAS_ENTRE_COPIAS) return null
  return (
    <Link to="/ajustes" className="mb-4 flex items-center gap-3 rounded-2xl bg-acento-suave px-4 py-3 text-sm active:brightness-95">
      <ShieldAlert className="h-5 w-5 shrink-0 text-acento" />
      <span className="flex-1">
        <span className="font-semibold">Hacé una copia de seguridad.</span>{' '}
        {estado.ultima ? `La última fue ${haceCuanto(estado.ultima)}.` : 'Todavía no hiciste ninguna.'}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-texto-3" />
    </Link>
  )
}

const CLAVE_SIN_INSTALAR = 'rutinas:ocultarInstalar'

function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribirLocal(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Modo privado o almacenamiento bloqueado: el cartel vuelve a aparecer, nada más.
  }
}

/**
 * En iPhone la app instalada guarda los datos aparte de Safari: hay que avisarlo
 * antes de que se cargue nada. En Android, el botón reemplaza al cartel de Chrome.
 */
function SugerenciaInstalar({ hayAlumnos }: { hayAlumnos: boolean }) {
  const puedeInstalar = usePuedeInstalar()
  const [oculta, setOculta] = useState(() => leerLocal(CLAVE_SIN_INSTALAR) === '1')
  const ios = esIOS()
  if (oculta || estaInstalada() || (!ios && !puedeInstalar)) return null

  return (
    <div className="mb-4 rounded-2xl border border-borde bg-sup px-4 py-3">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-acento" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Instalá la app en el teléfono</p>
          {ios ? (
            <>
              <p className="mt-1 text-texto-2">
                En Safari tocá <span className="font-semibold">Compartir</span> (si no lo ves, está en el menú <span className="font-semibold">···</span>) y
                después <span className="font-semibold">Agregar a inicio</span>. Hacelo antes de cargar alumnos: lo que cargues acá no pasa a la app instalada.
              </p>
              {hayAlumnos && (
                <p className="mt-1 text-texto-2">Para llevar lo que ya cargaste: Ajustes → Guardar copia, y en la app instalada, Ajustes → Restaurar.</p>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-texto-2">Queda con su ícono, abre sin internet y el teléfono cuida mejor los datos.</p>
              <Boton className="mt-3 h-10 text-sm" onClick={() => void instalar().catch(avisarError)}>
                Instalar
              </Boton>
            </>
          )}
        </div>
        <button
          type="button"
          aria-label="Ocultar sugerencia"
          onClick={() => {
            escribirLocal(CLAVE_SIN_INSTALAR, '1')
            setOculta(true)
          }}
          className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-texto-3 active:bg-sup-2"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
