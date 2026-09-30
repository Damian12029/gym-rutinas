import { useSyncExternalStore } from 'react'

// Chrome/Android avisa que la app se puede instalar con este evento; hay que
// guardarlo apenas llega para ofrecer el botón más tarde.
interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoInstalar | null = null
const suscriptos = new Set<() => void>()
const emitir = () => suscriptos.forEach((f) => f())

export function escucharInstalacion(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    evento = e as EventoInstalar
    emitir()
  })
  window.addEventListener('appinstalled', () => {
    evento = null
    emitir()
  })
}

export function usePuedeInstalar(): boolean {
  return useSyncExternalStore(
    (f) => {
      suscriptos.add(f)
      return () => suscriptos.delete(f)
    },
    () => evento !== null,
  )
}

export async function instalar(): Promise<void> {
  if (!evento) return
  await evento.prompt()
  await evento.userChoice
  evento = null
  emitir()
}

export function estaInstalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function esIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
