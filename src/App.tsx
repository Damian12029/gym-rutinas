import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { Avisos, NoEncontrado } from './componentes/ui'
import Inicio from './pantallas/Inicio'
import AlumnoPage from './pantallas/AlumnoPage'
import SesionPage from './pantallas/SesionPage'
import RutinaEditor from './pantallas/RutinaEditor'
import NuevaRutina from './pantallas/NuevaRutina'
import { ProgresoAlumno, ProgresoEjercicio } from './pantallas/ProgresoPage'
import Ajustes from './pantallas/Ajustes'
import { registrarNavegacion } from './lib/navegacion'

/**
 * Pantalla nueva: arriba. Al volver atrás: donde había quedado (p. ej. la lista de
 * alumnos a mitad de camino). La pantalla que vuelve primero muestra "Cargando", así
 * que se espera a que tenga alto suficiente antes de mover el scroll.
 */
function Scroll() {
  const location = useLocation()
  const tipo = useNavigationType()
  const posiciones = useRef(new Map<string, number>())
  // Por ruta, para volver a la altura de cada alumno al pasar de uno a otro en la sala.
  const porRuta = useRef(new Map<string, number>())
  const actual = useRef({ key: location.key, ruta: location.pathname })
  actual.current = { key: location.key, ruta: location.pathname }

  useLayoutEffect(() => {
    registrarNavegacion(tipo, location.key, location.pathname)
  }, [tipo, location.key, location.pathname])

  useEffect(() => {
    history.scrollRestoration = 'manual'
    const guardar = () => {
      posiciones.current.set(actual.current.key, window.scrollY)
      porRuta.current.set(actual.current.ruta, window.scrollY)
    }
    window.addEventListener('scroll', guardar, { passive: true })
    return () => window.removeEventListener('scroll', guardar)
  }, [])

  // Se lee al dibujar, antes de que la pantalla corta que vuelve recorte el scroll y
  // ese recorte se guarde encima de la posición buena.
  const deSala = (location.state as { sala?: boolean } | null)?.sala === true
  const destino = useMemo(
    () => (tipo === 'POP' ? (posiciones.current.get(location.key) ?? 0) : deSala ? (porRuta.current.get(location.pathname) ?? 0) : 0),
    [location.key, location.pathname, tipo, deSala],
  )

  useEffect(() => {
    if (destino === 0) {
      window.scrollTo(0, 0)
      return
    }
    const inicio = performance.now()
    let cuadro = 0
    const intentar = () => {
      const alcanza = document.documentElement.scrollHeight - window.innerHeight >= destino
      if (alcanza || performance.now() - inicio > 1000) window.scrollTo(0, destino)
      else cuadro = requestAnimationFrame(intentar)
    }
    intentar()
    return () => cancelAnimationFrame(cuadro)
  }, [destino, location.key])

  return null
}

// Al pasar de un alumno a otro se monta una pantalla nueva: nada del anterior queda colgado.
function SesionPorAlumno() {
  const { alumnoId, diaId } = useParams()
  return <SesionPage key={`${alumnoId}|${diaId}`} />
}

// HashRouter: la app es estática y se puede alojar en cualquier lado (GitHub Pages,
// una carpeta de nginx) sin configurar reescrituras de rutas.
export default function App() {
  return (
    <HashRouter>
      <Scroll />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/alumno/:alumnoId" element={<AlumnoPage />} />
        <Route path="/alumno/:alumnoId/dia/:rutinaId/:diaId" element={<SesionPorAlumno />} />
        <Route path="/alumno/:alumnoId/rutina/:rutinaId" element={<RutinaEditor />} />
        <Route path="/alumno/:alumnoId/nueva-rutina" element={<NuevaRutina />} />
        <Route path="/alumno/:alumnoId/progreso" element={<ProgresoAlumno />} />
        <Route path="/alumno/:alumnoId/progreso/:clave" element={<ProgresoEjercicio />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="*" element={<NoEncontrado texto="Esa pantalla no existe." />} />
      </Routes>
      <Avisos />
    </HashRouter>
  )
}
