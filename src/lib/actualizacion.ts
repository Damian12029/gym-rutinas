// Con una versión nueva publicada, el service worker la instala solo, pero recargar
// en medio de una carga borraría lo que todavía no se guardó (un texto pegado, una
// hoja abierta). Se espera a estar en la lista de alumnos, sin diálogos abiertos.

let pendiente = false

export function marcarVersionNueva(): void {
  pendiente = true
  recargarSiSeguro()
}

export function recargarSiSeguro(): void {
  if (!pendiente) return
  const enInicio = location.hash === '' || location.hash === '#' || location.hash === '#/'
  if (enInicio && !document.querySelector('dialog[open]')) location.reload()
}
