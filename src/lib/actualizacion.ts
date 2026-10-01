// Con una versión nueva publicada, el service worker la instala solo, pero recargar
// en medio de una carga borraría lo que todavía no se guardó (un texto pegado, una
// hoja abierta). Se espera a estar en la lista de alumnos, sin diálogos abiertos.

let pendiente = false
let recargarDondeSea = false
let registro: ServiceWorkerRegistration | undefined
let ultimaBusqueda = 0

export function marcarVersionNueva(): void {
  pendiente = true
  recargarSiSeguro()
}

export function recargarSiSeguro(): void {
  if (!pendiente) return
  const enInicio = location.hash === '' || location.hash === '#' || location.hash === '#/'
  if (recargarDondeSea || (enInicio && !document.querySelector('dialog[open]'))) location.reload()
}

/**
 * Android deja la app viva en memoria: al volver a abrirla retoma la pantalla sin
 * navegar, y el navegador solo busca versión nueva al navegar. Se busca a mano cada
 * vez que la app vuelve al frente (como mucho una vez por minuto).
 */
export function vigilarActualizaciones(r: ServiceWorkerRegistration | undefined): void {
  registro = r
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    recargarSiSeguro()
    if (!registro || Date.now() - ultimaBusqueda < 60_000) return
    ultimaBusqueda = Date.now()
    registro.update().catch(() => undefined)
  })
}

/** Para el botón de Ajustes. Devuelve false si ya está en la última versión. */
export async function buscarActualizacion(): Promise<boolean> {
  if (!registro) return false
  if (pendiente) location.reload()
  recargarDondeSea = true
  ultimaBusqueda = Date.now()
  await registro.update()
  const hayNueva = !!(registro.installing || registro.waiting)
  if (!hayNueva) recargarDondeSea = false
  return hayNueva
}
