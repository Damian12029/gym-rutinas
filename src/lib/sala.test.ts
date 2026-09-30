import { describe, expect, it } from 'vitest'
import { diaQueLeToca } from './consultas'
import type { Rutina } from './tipos'
import { nombresCortos } from './util'

const ej = (id: string) => ({ id, nombre: id, series: 3, reps: '12', descanso: '', indicaciones: '' })
const rutina: Rutina = {
  id: 'r',
  nombre: 'Rutina',
  creada: '2026-09-01',
  activa: true,
  dias: [
    { id: 'd1', nombre: 'Día 1', ejercicios: [ej('a'), ej('b')] },
    { id: 'd2', nombre: 'Día 2', ejercicios: [ej('c')] },
    { id: 'vacio', nombre: 'Día 3', ejercicios: [] },
    { id: 'd4', nombre: 'Día 4', ejercicios: [ej('d')] },
  ],
}
const hoy = '2026-09-30'

describe('diaQueLeToca', () => {
  it.each([
    ['sin nada anotado, el primero', undefined, 'd1'],
    ['después del día 1, el 2', { fecha: '2026-09-28', ejercicioId: 'b', actualizado: 1 }, 'd2'],
    ['saltea días vacíos', { fecha: '2026-09-28', ejercicioId: 'c', actualizado: 1 }, 'd4'],
    ['después del último vuelve al primero', { fecha: '2026-09-28', ejercicioId: 'd', actualizado: 1 }, 'd1'],
    ['si hoy ya anotó, el que está haciendo', { fecha: hoy, ejercicioId: 'c', actualizado: 1 }, 'd2'],
    ['lo último es de otra rutina: el primero', { fecha: '2026-09-28', ejercicioId: 'viejo', actualizado: 1 }, 'd1'],
  ])('%s', (_, ultimo, esperado) => {
    expect(diaQueLeToca(rutina, ultimo, hoy)?.id).toBe(esperado)
  })

  it('rutina sin ejercicios: ninguno', () => {
    expect(diaQueLeToca({ ...rutina, dias: [{ id: 'x', nombre: 'Día 1', ejercicios: [] }] }, undefined, hoy)).toBeUndefined()
  })
})

describe('nombresCortos', () => {
  it('primer nombre, con inicial del apellido si se repite', () => {
    const m = nombresCortos([
      { id: '1', nombre: 'Juan Pérez' },
      { id: '2', nombre: 'juan gómez' },
      { id: '3', nombre: 'María' },
    ])
    expect([...m.values()]).toEqual(['Juan P.', 'juan G.', 'María'])
  })
})
