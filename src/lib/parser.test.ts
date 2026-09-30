import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RegexSinPrevio, parsearRutina } from './parser'
import type { EjercicioParseado } from './tipos'

const ejemplo = readFileSync(new URL('./ejemplo-rutina.txt', import.meta.url), 'utf8')

function ej(
  nombre: string,
  series: number,
  reps: string,
  descanso = '',
  indicaciones = '',
): EjercicioParseado {
  return { nombre, series, reps, descanso, indicaciones }
}

/** Primer ejercicio de una línea suelta. */
function unaLinea(linea: string): EjercicioParseado {
  const r = parsearRutina(linea)
  expect(r.dias).toHaveLength(1)
  return r.dias[0].ejercicios[0]
}

describe('parsearRutina: ejemplo real', () => {
  it('lee los tres días con todos los campos', () => {
    expect(parsearRutina(ejemplo)).toEqual({
      titulo: '',
      dias: [
        {
          nombre: 'Día 1',
          ejercicios: [
            ej('Aperturas en polea sentado', 2, '15', '1 min', 'Una serie de calentamiento 12 rtc. Peso máximo'),
            ej('Press plano con barra', 2, '8 a 6', '1:30 min', 'Aproximación 8 rtc, peso máximo'),
            ej('Press inclinado con mancuernas', 3, '12', '1:30 min', 'Biserie con cruce de mancuernas'),
            ej('Cruce de mancuernas', 3, '12', '1:30 min', 'Biserie con press inclinado con mancuernas'),
            ej('Vuelos laterales con polea (trabajo unilateral)', 3, '15', '1 min', 'Polea a la altura de la muñeca'),
            ej('Curl con barra recta', 3, '12 a 15', '1:30 min'),
            ej('Curl con mancuernas en banco inclinado', 3, '8 a 12', '1:30 min'),
          ],
        },
        {
          nombre: 'Día 2',
          ejercicios: [
            ej('Extensión de gemelos con las piernas extendidas', 3, '15', '1:00 min'),
            ej('Prensa squat', 3, '12', '1:30 a 2 min', 'Carga progresiva'),
            ej('Extensión de cuádriceps', 3, '15', '1:30 a 2 min'),
            ej('Curl de femorales', 3, '12', '1:30 a 2 min'),
            ej('Estocadas avanzando', 2, '20', '1:30 a 2 min'),
          ],
        },
        {
          nombre: 'Día 3',
          ejercicios: [
            ej(
              'Remo con barra agarre prono',
              3,
              '10 a 12',
              '1:30 min',
              'Una serie de calentamiento 10 rct. Carga progresiva',
            ),
            ej('Dorsalera agarre prono', 3, '12', '1:30 min'),
            ej('Remo unilateral en polea sentado', 3, '12', '1:30 min'),
            ej('Press militar en maquina', 2, '8 a 12', '1:30 min', 'Un set de calentamiento 12 rtc, peso máximo'),
            ej('Extensión de tríceps en polea con barra', 3, '15', '1:30 min'),
            ej('Fondos en barra paralela', 3, '12 a 15', '1:30 a 2:00 min'),
            ej('Press francés en banco plano con barra W', 2, '12 a 15', '1:30 a 2:00 min'),
          ],
        },
      ],
    })
  })
})

describe('parsearRutina: rutina tipo WhatsApp', () => {
  it('negritas, viñetas numeradas, subtítulo y abreviaturas', () => {
    const texto = [
      'RUTINA JUAN - MARZO',
      '',
      '*DIA 1* (Pecho)',
      '1. Press banca 4x10',
      "2. Press inclinado mancuernas 3x12 desc 1'",
      '3. Aperturas 3x15 - pausa 60"',
      '4. Fondos 3xfallo',
      '',
      '*DIA 2*',
      'Espalda y biceps',
      '- Dominadas 4 x máx',
      '- Remo con barra 4 x 10/8/6/6 c/descanso de 2 min',
      '- Jalón al pecho 3 x 12 agarre cerrado',
      '- Curl martillo 3x12 c/brazo',
    ].join('\n')
    expect(parsearRutina(texto)).toEqual({
      titulo: 'RUTINA JUAN - MARZO',
      dias: [
        {
          nombre: 'Día 1 (Pecho)',
          ejercicios: [
            ej('Press banca', 4, '10'),
            ej('Press inclinado mancuernas', 3, '12', '1 min'),
            ej('Aperturas', 3, '15', '60 seg'),
            ej('Fondos', 3, 'al fallo'),
          ],
        },
        {
          nombre: 'Día 2 - Espalda y biceps',
          ejercicios: [
            ej('Dominadas', 4, 'máx'),
            ej('Remo con barra', 4, '10-8-6-6', '2 min'),
            ej('Jalón al pecho', 3, '12', '', 'Agarre cerrado'),
            ej('Curl martillo', 3, '12 c/brazo'),
          ],
        },
      ],
    })
  })
})

describe('parsearRutina: series x reps', () => {
  it.each([
    ['Sentadilla 3x12', 3, '12'],
    ['Sentadilla 3 x 12', 3, '12'],
    ['Sentadilla 3 X 12', 3, '12'],
    ['Sentadilla 3×12', 3, '12'],
    ['Sentadilla 3 x12', 3, '12'],
    ['Sentadilla 3x 12', 3, '12'],
    ['Sentadilla 3 x 12 rtc', 3, '12'],
    ['Sentadilla 4 x 10 reps', 4, '10'],
    ['Sentadilla 3 series de 12', 3, '12'],
    ['Sentadilla 3 series de 12 repeticiones', 3, '12'],
    ['Sentadilla 3 series 12', 3, '12'],
    ['Sentadilla 4 series', 4, ''],
    ['Sentadilla 3 x 10 a 12', 3, '10 a 12'],
  ])('%s', (linea, series, reps) => {
    expect(unaLinea(linea)).toEqual(ej('Sentadilla', series, reps))
  })

  it.each([
    ['Press plano 4 x 12-10-8-6', 4, '12-10-8-6'],
    ['Press plano 4 x 12/10/8/6', 4, '12-10-8-6'],
    ['Press plano 4 x 12, 10, 8, 6', 4, '12-10-8-6'],
    ['Press plano 3 x 12 - 10 - 8', 3, '12-10-8'],
  ])('pirámide: %s', (linea, series, reps) => {
    expect(unaLinea(linea)).toEqual(ej('Press plano', series, reps))
  })

  it.each([
    ['Estocadas 3 x 10 c/pierna', '10 c/pierna'],
    ['Estocadas 3 x 10 por pierna', '10 c/pierna'],
    ['Estocadas 3 x 10 rtc c/ pierna', '10 c/pierna'],
    ['Estocadas 3 x 30 seg', '30 seg'],
    ['Estocadas 3 x 30"', '30 seg'],
    ['Estocadas 3 x al fallo', 'al fallo'],
  ])('reps con sufijo: %s', (linea, reps) => {
    expect(unaLinea(linea)).toEqual(ej('Estocadas', 3, reps))
  })

  it('línea sin patrón: 3 series por defecto y reps vacío', () => {
    const r = parsearRutina('Día 1\nPlancha abdominal\nSentadilla 4x10')
    expect(r.dias[0].ejercicios).toEqual([ej('Plancha abdominal', 3, ''), ej('Sentadilla', 4, '10')])
  })

  it('patrón al principio: el nombre sale del texto que sigue', () => {
    expect(unaLinea('3 x 12 sentadilla búlgara, bajar lento')).toEqual(
      ej('Sentadilla búlgara', 3, '12', '', 'Bajar lento'),
    )
  })

  it('el calentamiento con patrón no cuenta como serie efectiva', () => {
    expect(unaLinea('Sentadilla calentamiento 1x15, 3x10')).toEqual(
      ej('Sentadilla', 3, '10', '', 'Calentamiento 1x15'),
    )
    expect(unaLinea('Sentadilla 1 serie de calentamiento de 15, 4 x 8')).toEqual(
      ej('Sentadilla', 4, '8', '', '1 serie de calentamiento de 15'),
    )
  })

  it('solo repeticiones sin series: series por defecto', () => {
    expect(unaLinea('Abdominales 20 rtc')).toEqual(ej('Abdominales', 3, '20'))
  })

  it('series fuera de rango no se toman como patrón', () => {
    expect(unaLinea('Soga 50 x 2')).toEqual(ej('Soga 50 x 2', 3, ''))
  })
})

describe('parsearRutina: descanso', () => {
  it.each([
    ['Sentadilla 3x12. Descanso 90 seg', '90 seg'],
    ['Sentadilla 3x12. Descanso 90"', '90 seg'],
    ['Sentadilla 3x12. Descanso 90', '90 seg'],
    ['Sentadilla 3x12. Descanso 1:30', '1:30 min'],
    ['Sentadilla 3x12. Descanso 1: 30.', '1:30 min'],
    ['Sentadilla 3x12. Descanso 1.30', '1:30 min'],
    ['Sentadilla 3x12. Descanso 2', '2 min'],
    ['Sentadilla 3x12. Desc. 1 min', '1 min'],
    ['Sentadilla 3x12. Pausa 45 segundos', '45 seg'],
    ['Sentadilla 3x12. Descanso: 2 minutos.', '2 min'],
    ['Sentadilla 3x12 descanso 1:30 a 2 min', '1:30 a 2 min'],
    ['Sentadilla 3x12. Descanso 1:30 a 2:00 min', '1:30 a 2:00 min'],
    ['Sentadilla 3x12. Descanso 1-2 min', '1 a 2 min'],
    ["Sentadilla 3x12. Descanso 1'", '1 min'],
    ['Sentadilla 3x12, 90 seg de descanso', '90 seg'],
    ['Sentadilla 3x12. Descanso 1 min entre series', '1 min entre series'],
  ])('%s', (linea, descanso) => {
    expect(unaLinea(linea)).toEqual(ej('Sentadilla', 3, '12', descanso))
  })

  it('una línea de descanso suelta al principio del día vale para todos', () => {
    const r = parsearRutina('Día 1\nDescanso 1 min entre series\nSentadilla 3x12\nPress 3x10. Descanso 2 min')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Sentadilla', 3, '12', '1 min entre series'),
      ej('Press', 3, '10', '2 min'),
    ])
  })

  it('"Descanso ... entre series" al final del día también vale para todos', () => {
    const r = parsearRutina('Día 1\nSentadilla 3x12\nPress 3x10\nDescanso 1:30 entre series')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Sentadilla', 3, '12', '1:30 min entre series'),
      ej('Press', 3, '10', '1:30 min entre series'),
    ])
  })

  it('nombre en una línea y series y descanso en las siguientes', () => {
    const r = parsearRutina('Día 1\nPress plano con barra\n3 x 10\nDescanso 1:30\nSentadilla 4x8')
    expect(r.dias[0].ejercicios).toEqual([ej('Press plano con barra', 3, '10', '1:30 min'), ej('Sentadilla', 4, '8')])
  })
})

describe('parsearRutina: viñetas', () => {
  it.each([
    '- Sentadilla 3x12',
    '• Sentadilla 3x12',
    '* Sentadilla 3x12',
    '*Sentadilla* 3x12',
    '1. Sentadilla 3x12',
    '1) Sentadilla 3x12',
    '1- Sentadilla 3x12',
    'a) Sentadilla 3x12',
    '1️⃣ Sentadilla 3x12',
    '💪 Sentadilla 3x12',
    '   Sentadilla   3x12  ',
    'a. Sentadilla 3x12',
    'Ej 1: Sentadilla 3x12',
    'Ejercicio 2 - Sentadilla 3x12',
    '1 Sentadilla 3x12',
  ])('%s', (linea) => {
    expect(unaLinea(linea)).toEqual(ej('Sentadilla', 3, '12'))
  })
})

describe('parsearRutina: encabezados de día', () => {
  it.each([
    ['Día 1', 'Día 1'],
    ['DIA 2:', 'Día 2'],
    ['Dia 3 - Piernas', 'Día 3 - Piernas'],
    ['Día 1: pecho y bíceps', 'Día 1: pecho y bíceps'],
    ['día1', 'Día 1'],
    ['Día A', 'Día A'],
    ['*DÍA 4*', 'Día 4'],
    ['D2', 'Día 2'],
    ['Lunes', 'Lunes'],
    ['martes - espalda', 'Martes - espalda'],
    ['MIERCOLES:', 'Miercoles'],
    ['Rutina A', 'Rutina A'],
    ['Primer día', 'Primer día'],
    ['Día de piernas', 'Día de piernas'],
    ['Día 1 (lunes)', 'Día 1 (lunes)'],
  ])('%s', (encabezado, nombre) => {
    const r = parsearRutina(`${encabezado}\nSentadilla 3x12`)
    expect(r.titulo).toBe('')
    expect(r.dias).toEqual([{ nombre, ejercicios: [ej('Sentadilla', 3, '12')] }])
  })

  it('varios días en orden y descarta los días vacíos', () => {
    const r = parsearRutina('Día 1\nSentadilla 3x12\n\nDía 2\n\nDía 3\nPress plano 4x10')
    expect(r.dias.map((d) => d.nombre)).toEqual(['Día 1', 'Día 3'])
  })

  it('ejercicio en la misma línea del encabezado', () => {
    expect(parsearRutina('Día 1: sentadilla 3x12\nPress 3x10').dias).toEqual([
      { nombre: 'Día 1', ejercicios: [ej('Sentadilla', 3, '12'), ej('Press', 3, '10')] },
    ])
  })

  it('subtítulo de grupos musculares bajo el encabezado', () => {
    const r = parsearRutina('Día 1\nPecho y bíceps\nPress plano 3x10')
    expect(r.dias).toEqual([{ nombre: 'Día 1 - Pecho y bíceps', ejercicios: [ej('Press plano', 3, '10')] }])
  })

  it('una línea con patrón nunca es encabezado', () => {
    const r = parsearRutina('Día 1\nDía 2 sentadillas 3x12')
    expect(r.dias).toEqual([{ nombre: 'Día 2', ejercicios: [ej('Sentadillas', 3, '12')] }])
  })
})

describe('parsearRutina: título y texto sin encabezados', () => {
  it('sin encabezados todo va a "Día 1"', () => {
    expect(parsearRutina('Sentadilla 3x12\nPress plano 3x10\nPlancha 3 x 30 seg')).toEqual({
      titulo: '',
      dias: [
        {
          nombre: 'Día 1',
          ejercicios: [ej('Sentadilla', 3, '12'), ej('Press plano', 3, '10'), ej('Plancha', 3, '30 seg')],
        },
      ],
    })
  })

  it.each([
    ['Rutina de Juan\n\nDía 1\nSentadilla 3x12', 'Rutina de Juan', 'Día 1'],
    ['Juan Pérez\nDía 1\nSentadilla 3x12', 'Juan Pérez', 'Día 1'],
    ['Rutina hipertrofia\nSentadilla 3x12', 'Rutina hipertrofia', 'Día 1'],
    ['*Juan Pérez*\nObjetivo: fuerza\n\nLunes\nSentadilla 3x12', 'Juan Pérez - Objetivo: fuerza', 'Lunes'],
  ])('título antes del primer día: %j', (texto, titulo, dia) => {
    const r = parsearRutina(texto)
    expect(r.titulo).toBe(titulo)
    expect(r.dias).toEqual([{ nombre: dia, ejercicios: [ej('Sentadilla', 3, '12')] }])
  })

  it('una línea suelta que nombra un ejercicio no es título', () => {
    const r = parsearRutina('Plancha abdominal\nSentadilla 3x12')
    expect(r.titulo).toBe('')
    expect(r.dias[0].ejercicios).toEqual([ej('Plancha abdominal', 3, ''), ej('Sentadilla', 3, '12')])
  })

  it('ejercicios antes del primer encabezado van a un día "General"', () => {
    const r = parsearRutina('Bici 10 min\nDía 1\nSentadilla 3x12')
    expect(r.dias.map((d) => d.nombre)).toEqual(['General', 'Día 1'])
  })

  it.each(['', '   ', '\n\n  \n', '---'])('texto vacío: %j', (texto) => {
    expect(parsearRutina(texto)).toEqual({ titulo: '', dias: [] })
  })

  it('acepta finales de línea de Windows', () => {
    expect(parsearRutina('Día 1\r\nSentadilla 3x12\r\n').dias).toEqual([
      { nombre: 'Día 1', ejercicios: [ej('Sentadilla', 3, '12')] },
    ])
  })
})

describe('parsearRutina: biseries y varios ejercicios por línea', () => {
  it('triserie: un ejercicio por patrón con los otros en indicaciones', () => {
    const r = parsearRutina('Triserie: curl 3x12, martillo 3x12 y concentrado 3x10. Descanso 2 min')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Curl', 3, '12', '2 min', 'Triserie con martillo y concentrado'),
      ej('Martillo', 3, '12', '2 min', 'Triserie con curl y concentrado'),
      ej('Concentrado', 3, '10', '2 min', 'Triserie con curl y martillo'),
    ])
  })

  it('superserie conserva la etiqueta', () => {
    expect(parsearRutina('Press plano 3x10 superserie con aperturas 3x12').dias[0].ejercicios).toEqual([
      ej('Press plano', 3, '10', '', 'Superserie con aperturas'),
      ej('Aperturas', 3, '12', '', 'Superserie con press plano'),
    ])
  })

  it('biserie con un solo patrón no se parte', () => {
    expect(unaLinea('Curl biserie 3x12')).toEqual(ej('Curl', 3, '12', '', 'Biserie'))
  })

  it('dos ejercicios en la misma línea sin la palabra biserie se parten sin etiqueta', () => {
    expect(parsearRutina('Press plano 3x10 y aperturas 3x12').dias[0].ejercicios).toEqual([
      ej('Press plano', 3, '10'),
      ej('Aperturas', 3, '12'),
    ])
  })

  it('un segundo patrón sin nombre queda en indicaciones', () => {
    expect(unaLinea('Sentadilla 3x10, peso máximo 2x6')).toEqual(ej('Sentadilla', 3, '10', '', 'Peso máximo 2x6'))
  })
})

describe('parsearRutina: nombre e indicaciones', () => {
  it.each([
    ['Press plano, agarre cerrado 3x10', ej('Press plano', 3, '10', '', 'Agarre cerrado')],
    ['Press plano - agarre cerrado - 3x10', ej('Press plano', 3, '10', '', 'Agarre cerrado')],
    ['Sentadilla; bajar lento 3x10', ej('Sentadilla', 3, '10', '', 'Bajar lento')],
    ['Remo (agarre neutro, codos pegados) 3x12', ej('Remo (agarre neutro, codos pegados)', 3, '12')],
    ['Sentadilla drop set 3x10', ej('Sentadilla', 3, '10', '', 'Drop set')],
    ['Press 3x10 al fallo la última.', ej('Press', 3, '10', '', 'Al fallo la última')],
    ['Plancha con peso de 1.5 kg 3 x 30 seg', ej('Plancha con peso de 1.5 kg', 3, '30 seg')],
    ['press militar 3x12.', ej('Press militar', 3, '12')],
  ])('%s', (linea, esperado) => {
    expect(unaLinea(linea)).toEqual(esperado)
  })

  it('nunca pierde el texto de una línea sin nombre reconocible', () => {
    const r = parsearRutina('Día 1\nSentadilla 3x12\n2 x 8 al fallo')
    expect(r.dias[0].ejercicios).toEqual([ej('Sentadilla', 3, '12', '', '2 x 8 al fallo')])
  })
})

describe('parsearRutina: pausas y descansos', () => {
  it('"con pausa" seguido de series x reps no es un descanso', () => {
    const r = parsearRutina(
      'Día 1\nSentadilla con pausa 3 x 8. Descanso 2 min\nPress banca con pausa 4x6\nPeso muerto pausa 3 x 5',
    )
    expect(r.dias[0].ejercicios).toEqual([
      ej('Sentadilla con pausa', 3, '8', '2 min'),
      ej('Press banca con pausa', 4, '6'),
      ej('Peso muerto pausa', 3, '5'),
    ])
  })

  it('una pausa de pocos segundos es técnica y va a indicaciones', () => {
    const r = parsearRutina('Dia 1\nPress militar 4x10 con 2 seg de pausa abajo\nSentadilla pausa 2 seg 4x6')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Press militar', 4, '10', '', 'Con 2 seg de pausa abajo'),
      ej('Sentadilla', 4, '6', '', 'Pausa 2 seg'),
    ])
  })

  it.each([
    ['Press plano 4x10. Descanso 1’30”', '1:30 min'],
    ['Press plano 4x10. Descanso 1’30', '1:30 min'],
    ['Press plano 4x10 desc 1´30', '1:30 min'],
    ['Press plano 4x10 desc 2´', '2 min'],
    ['Press plano 4x10. Descanso 1 min 30 seg', '1:30 min'],
    ['Press plano 4x10 descanso 1,30 min', '1:30 min'],
  ])('minutos y segundos como se tipean en el celular: %s', (linea, descanso) => {
    expect(unaLinea(linea)).toEqual(ej('Press plano', 4, '10', descanso))
  })

  it('segundos con doble apóstrofo tipográfico en las reps', () => {
    expect(unaLinea('Plancha 3 x 30’’')).toEqual(ej('Plancha', 3, '30 seg'))
  })

  it('línea de descanso general con dos reglas no crea un ejercicio', () => {
    const r = parsearRutina('Dia 1\nDescanso: 60 segundos entre series y 2 min entre ejercicios\nPress banca 4x10\nRemo 4x10')
    const descanso = '60 seg entre series y 2 min entre ejercicios'
    expect(r.dias[0].ejercicios).toEqual([ej('Press banca', 4, '10', descanso), ej('Remo', 4, '10', descanso)])
  })

  it('lo que sigue al descanso después de un punto es una indicación, no parte del descanso', () => {
    const r = parsearRutina('Dia 1\nDescanso 2 min. Hacer todo con buena técnica\nPress 3x10\nRemo 3x10')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Press', 3, '10', '2 min', 'Hacer todo con buena técnica'),
      ej('Remo', 3, '10', '2 min'),
    ])
  })

  it('descanso escrito en el encabezado del día vale para todo el día', () => {
    const r = parsearRutina('Día 1 (descanso 1 min entre series)\nPress banca 4x10\nDía 2 (descanso 90 seg)\nSentadilla 4x10')
    expect(r.dias).toEqual([
      { nombre: 'Día 1', ejercicios: [ej('Press banca', 4, '10', '1 min entre series')] },
      { nombre: 'Día 2', ejercicios: [ej('Sentadilla', 4, '10', '90 seg')] },
    ])
  })
})

describe('parsearRutina: otras formas de escribir series y reps', () => {
  it('series x reps x peso: el peso va a indicaciones', () => {
    const r = parsearRutina('Dia 1\nPress banca 4 x 10 x 60kg\nSentadilla 5x5x100\nPress 4 x 8 x 80 kg. Desc 2 min')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Press banca', 4, '10', '', '60kg'),
      ej('Sentadilla', 5, '5', '', '100'),
      ej('Press', 4, '8', '2 min', '80 kg'),
    ])
  })

  it.each([
    ['Sentadilla 12 reps x 4', 4, '12'],
    ['Sentadilla 10 rep x 3 series', 3, '10'],
    ['Sentadilla 12 rtc x 3 series', 3, '12'],
    ['Sentadilla 10 repeticiones x 4 series', 4, '10'],
    ['Sentadilla - 4 series - 10 reps', 4, '10'],
    ['Sentadilla 4 series, 10 reps', 4, '10'],
  ])('reps antes que series o separadas: %s', (linea, series, reps) => {
    expect(unaLinea(linea)).toEqual(ej('Sentadilla', series, reps))
  })

  it.each([
    ['Press plano 3 x 12, 10 y 8', 3, '12-10-8'],
    ['Press plano 4 x 12-10-8 y 6', 4, '12-10-8-6'],
  ])('pirámide con "y" en el último escalón: %s', (linea, series, reps) => {
    expect(unaLinea(linea)).toEqual(ej('Press plano', series, reps))
  })

  it.each([
    ['Estocadas 3x12 x lado', '12 c/lado'],
    ['Estocadas 3 x 30 seg x lado', '30 seg c/lado'],
    ['Estocadas 3 x 12 x pierna', '12 c/pierna'],
  ])('"x lado" es por lado: %s', (linea, reps) => {
    expect(unaLinea(linea)).toEqual(ej('Estocadas', 3, reps))
  })

  it('serie de calentamiento marcada entre paréntesis después del patrón', () => {
    const r = parsearRutina('Dia 1\nPress plano 1x15 (calentamiento) + 3x10\nSentadilla 1 x 20 (entrada en calor), 4 x 8')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Press plano', 3, '10', '', '1x15 (calentamiento)'),
      ej('Sentadilla', 4, '8', '', '1 x 20 (entrada en calor)'),
    ])
  })

  it('un paréntesis que trae su propio patrón no vuelve calentamiento al anterior', () => {
    expect(unaLinea('Sentadilla 3x10 (aproximación 1x15)')).toEqual(
      ej('Sentadilla', 3, '10', '', '(aproximación 1x15)'),
    )
  })

  it('un número al principio sin series y reps completas no es viñeta', () => {
    expect(unaLinea('20 abdominales 3 series')).toEqual(ej('20 abdominales', 3, ''))
  })

  it('lista numerada sin punto ni paréntesis', () => {
    const r = parsearRutina('Dia 1\n1 Press plano 4x10\n2 Aperturas 3x12\n3 Fondos 3x10')
    expect(r.dias[0].ejercicios).toEqual([ej('Press plano', 4, '10'), ej('Aperturas', 3, '12'), ej('Fondos', 3, '10')])
  })
})

describe('parsearRutina: más encabezados y títulos', () => {
  it('"Días 1 y 3" en plural abre un día', () => {
    const r = parsearRutina('DIAS 1 Y 3\nPress banca 4x10\nRemo 4x10\nDIAS 2 Y 4\nSentadilla 4x10\nPeso muerto 4x6')
    expect(r).toEqual({
      titulo: '',
      dias: [
        { nombre: 'Días 1 y 3', ejercicios: [ej('Press banca', 4, '10'), ej('Remo', 4, '10')] },
        { nombre: 'Días 2 y 4', ejercicios: [ej('Sentadilla', 4, '10'), ej('Peso muerto', 4, '6')] },
      ],
    })
  })

  it('ordinal con ° o º', () => {
    const r = parsearRutina('1° DIA\nPress banca 4x10\n2º día\nSentadilla 4x10')
    expect(r).toEqual({
      titulo: '',
      dias: [
        { nombre: 'Día 1', ejercicios: [ej('Press banca', 4, '10')] },
        { nombre: 'Día 2', ejercicios: [ej('Sentadilla', 4, '10')] },
      ],
    })
  })

  it.each([
    ['Rutina 4 dias\nDia 1\nPress banca 4x10\nDia 2\nSentadilla 4x10', 'Rutina 4 dias', ['Día 1', 'Día 2']],
    ['Rutina 1 - Hipertrofia\nDía 1\nPress banca 4x10', 'Rutina 1 - Hipertrofia', ['Día 1']],
  ])('"Rutina N" seguida de un día es el título: %j', (texto, titulo, nombres) => {
    const r = parsearRutina(texto)
    expect(r.titulo).toBe(titulo)
    expect(r.dias.map((d) => d.nombre)).toEqual(nombres)
  })

  it('la semana antes del día en la misma línea', () => {
    const r = parsearRutina('Semana 1 - Día 1\nPress banca 4x10\nSemana 1 - Día 2\nSentadilla 4x10')
    expect(r).toEqual({
      titulo: '',
      dias: [
        { nombre: 'Semana 1 - Día 1', ejercicios: [ej('Press banca', 4, '10')] },
        { nombre: 'Semana 1 - Día 2', ejercicios: [ej('Sentadilla', 4, '10')] },
      ],
    })
  })

  it('varias semanas en líneas propias se anteponen a sus días', () => {
    const r = parsearRutina('Semana 1\nDia 1\nPress 4x10\nSemana 2\nDia 1\nPress 4x8')
    expect(r).toEqual({
      titulo: '',
      dias: [
        { nombre: 'Semana 1 - Día 1', ejercicios: [ej('Press', 4, '10')] },
        { nombre: 'Semana 2 - Día 1', ejercicios: [ej('Press', 4, '8')] },
      ],
    })
  })

  it('sin encabezados de día, las líneas de grupo muscular separan los días', () => {
    const r = parsearRutina('PECHO\nPress banca 4x10\nAperturas 3x12\nESPALDA\nRemo 4x10\nDorsalera 3x12')
    expect(r).toEqual({
      titulo: '',
      dias: [
        { nombre: 'PECHO', ejercicios: [ej('Press banca', 4, '10'), ej('Aperturas', 3, '12')] },
        { nombre: 'ESPALDA', ejercicios: [ej('Remo', 4, '10'), ej('Dorsalera', 3, '12')] },
      ],
    })
  })

  it.each(['Martina Barraza', 'Lucas Barrameda', 'Juan Puente'])('nombre del alumno antes del día: %s', (nombre) => {
    expect(parsearRutina(`${nombre}\nDía 1\nPress banca 4x10`)).toEqual({
      titulo: nombre,
      dias: [{ nombre: 'Día 1', ejercicios: [ej('Press banca', 4, '10')] }],
    })
  })
})

describe('parsearRutina: rótulos y varios ejercicios por línea', () => {
  it('"Grupo: ejercicio NxM" toma el ejercicio, no el rótulo', () => {
    const r = parsearRutina(
      'Dia 2\nTriserie hombros: press militar 3x10, vuelos laterales 3x12 y vuelos posteriores 3x15. Descanso 2 min\n\n' +
        'Dia 3\nAbdominales: crunch 3x20, oblicuos 3x20, plancha 3x30 seg',
    )
    expect(r.dias).toEqual([
      {
        nombre: 'Día 2',
        ejercicios: [
          ej('Press militar', 3, '10', '2 min', 'Triserie con vuelos laterales y vuelos posteriores. Hombros'),
          ej('Vuelos laterales', 3, '12', '2 min', 'Triserie con press militar y vuelos posteriores'),
          ej('Vuelos posteriores', 3, '15', '2 min', 'Triserie con press militar y vuelos laterales'),
        ],
      },
      {
        nombre: 'Día 3',
        ejercicios: [ej('Crunch', 3, '20', '', 'Abdominales'), ej('Oblicuos', 3, '20'), ej('Plancha', 3, '30 seg')],
      },
    ])
  })

  it('biserie separada con "/"', () => {
    expect(parsearRutina('Biserie: press inclinado 3x12 / cruce 3x12. Desc 1:30').dias[0].ejercicios).toEqual([
      ej('Press inclinado', 3, '12', '1:30 min', 'Biserie con cruce'),
      ej('Cruce', 3, '12', '1:30 min', 'Biserie con press inclinado'),
    ])
  })

  it('biserie unida con "con"', () => {
    const r = parsearRutina(
      'Press inclinado con mancuernas biserie 3 x 12 con cruce de mancuernas 3 x 12. Descanso 1:30 min.',
    )
    expect(r.dias[0].ejercicios).toEqual([
      ej('Press inclinado con mancuernas', 3, '12', '1:30 min', 'Biserie con cruce de mancuernas'),
      ej('Cruce de mancuernas', 3, '12', '1:30 min', 'Biserie con press inclinado con mancuernas'),
    ])
  })

  it('"Entrada en calor: ..." es un ejercicio aunque no vaya primero', () => {
    const r = parsearRutina('Dia 1\nCardio: cinta 20 minutos\nEntrada en calor: 10 min bici')
    expect(r.dias[0].ejercicios).toEqual([
      ej('Cardio', 3, '', '', 'Cinta 20 minutos'),
      ej('Entrada en calor', 3, '', '', '10 min bici'),
    ])
  })
})

// Safari < 16.4 no soporta lookbehind: si aparece uno, la app no carga en esos iPhone.
describe('compatibilidad con iPhone viejos', () => {
  it('el lector no usa lookbehind', () => {
    const fuente = readFileSync(new URL('./parser.ts', import.meta.url), 'utf8')
    expect(fuente).not.toMatch(/\(\?<[!=]/)
  })

  // Compara la emulación contra el lookbehind nativo de Node en todas las formas de uso.
  const casos: [string, string, RegExp][] = [
    ['\\p{L}', String.raw`(bi|tri)[\s-]?series?(?!\p{L})`, /\p{L}/u],
    ['[\\p{N}.,:/]', String.raw`(\d{1,2})\s*x\s*(\d{1,3})`, /[\p{N}.,:/]/u],
    ['[\\p{L}\\p{N}]', String.raw`_([^_]+)_(?![\p{L}\p{N}])`, /[\p{L}\p{N}]/u],
    ['\\p{L}', String.raw`(?:y|e|con)(?!\p{L})`, /\p{L}/u],
  ]
  const textos = [
    'biserie 3x12 y trisérie 4 x 10, superserie',
    'abiserie bi-serie 12x3x4 1.3x4 3:3x2 /2x5 3x10 23x4',
    'un _texto_ con_guion_bajo_ y _otro_',
    'y e con cony eco con y',
    '😀bi serie 😀3x5 é3x5 ñbiserie',
    '',
  ]

  for (const [previo, cuerpo, clase] of casos) {
    for (const flags of ['giu', 'iu', 'gu', 'u']) {
      it(`/(?<!${previo})${cuerpo}/${flags}`, () => {
        const nativa = new RegExp(`(?<!${previo})${cuerpo}`, flags)
        const emulada = () => new RegexSinPrevio(cuerpo, flags, clase)
        for (const t of textos) {
          if (flags.includes('g')) {
            expect([...t.matchAll(emulada())].map((m) => [m.index, ...m])).toEqual([...t.matchAll(nativa)].map((m) => [m.index, ...m]))
            expect(t.match(emulada())).toEqual(t.match(nativa))
          } else {
            const a = emulada().exec(t)
            const b = new RegExp(nativa).exec(t)
            expect(a ? [a.index, ...a] : null).toEqual(b ? [b.index, ...b] : null)
          }
          expect(t.replace(emulada(), '<$&>')).toBe(t.replace(new RegExp(nativa), '<$&>'))
          expect(emulada().test(t)).toBe(new RegExp(nativa).test(t))
          expect(t.search(emulada())).toBe(t.search(nativa))
          expect(t.split(emulada())).toEqual(t.split(nativa))
        }
      })
    }
  }
})
