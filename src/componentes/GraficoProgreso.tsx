import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { fechaCorta, formatoKg } from '../lib/util'

export interface Punto {
  fecha: string
  valor: number
}

const ALTO = 190
const M = { arriba: 16, derecha: 44, abajo: 24, izquierda: 36 }

function diaNumero(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86_400_000
}

/** Escala "linda": marcas en múltiplos de 1, 2, 2,5 o 5 × 10^n. */
function marcasY(min: number, max: number): number[] {
  if (min === max) {
    const paso = min >= 20 ? 5 : 1
    return [min - paso, min, min + paso].filter((v) => v >= 0)
  }
  const bruto = (max - min) / 3
  const exp = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * exp).find((p) => p >= bruto) ?? 10 * exp
  const desde = Math.floor(min / paso) * paso
  const hasta = Math.ceil(max / paso) * paso
  const marcas: number[] = []
  for (let v = desde; v <= hasta + paso / 2; v += paso) marcas.push(Math.round(v * 100) / 100)
  return marcas
}

/** Línea del peso máximo por sesión. Una sola serie: el título de la pantalla la nombra. */
export default function GraficoProgreso({ puntos }: { puntos: Punto[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)
  const [activo, setActivo] = useState<number | null>(null)

  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setAncho(Math.floor(e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const ys = marcasY(Math.min(...puntos.map((p) => p.valor)), Math.max(...puntos.map((p) => p.valor)))
  const yMin = ys[0]
  const yMax = ys[ys.length - 1]
  const x0 = diaNumero(puntos[0].fecha)
  const x1 = diaNumero(puntos[puntos.length - 1].fecha)
  const anchoPlot = Math.max(0, ancho - M.izquierda - M.derecha)
  const altoPlot = ALTO - M.arriba - M.abajo

  const px = (fecha: string) => M.izquierda + (x1 === x0 ? anchoPlot / 2 : ((diaNumero(fecha) - x0) / (x1 - x0)) * anchoPlot)
  const py = (v: number) => M.arriba + (yMax === yMin ? altoPlot / 2 : (1 - (v - yMin) / (yMax - yMin)) * altoPlot)

  const coords = puntos.map((p) => ({ x: px(p.fecha), y: py(p.valor), p }))
  const linea = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area =
    coords.length > 1 ? `${linea} L${coords[coords.length - 1].x.toFixed(1)},${M.arriba + altoPlot} L${coords[0].x.toFixed(1)},${M.arriba + altoPlot} Z` : ''
  const ultimo = coords[coords.length - 1]

  function buscar(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    let mejor = 0
    for (let i = 1; i < coords.length; i++) if (Math.abs(coords[i].x - x) < Math.abs(coords[mejor].x - x)) mejor = i
    setActivo(mejor)
  }

  const sel = activo != null ? coords[activo] : null

  return (
    <div ref={contenedor} className="relative w-full select-none" style={{ height: ALTO }}>
      {ancho > 0 && (
        <svg
          width={ancho}
          height={ALTO}
          role="img"
          aria-label={`Peso máximo por sesión: de ${formatoKg(puntos[0].valor)} a ${formatoKg(ultimo.p.valor)} kg`}
          onPointerDown={buscar}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons ? buscar(e) : undefined)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActivo(null)}
          style={{ touchAction: 'pan-y' }}
        >
          {ys.map((v) => (
            <g key={v}>
              <line x1={M.izquierda} x2={M.izquierda + anchoPlot} y1={py(v)} y2={py(v)} stroke="var(--borde)" strokeWidth={1} />
              <text
                x={M.izquierda - 6}
                y={py(v)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="var(--texto-3)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatoKg(v)}
              </text>
            </g>
          ))}
          <text
            x={M.izquierda}
            y={ALTO - 6}
            fontSize={11}
            fill="var(--texto-3)"
            textAnchor={coords.length > 1 ? 'start' : 'middle'}
            dx={coords.length > 1 ? 0 : anchoPlot / 2}
          >
            {fechaCorta(puntos[0].fecha)}
          </text>
          {coords.length > 1 && (
            <text x={M.izquierda + anchoPlot} y={ALTO - 6} fontSize={11} fill="var(--texto-3)" textAnchor="end">
              {fechaCorta(ultimo.p.fecha)}
            </text>
          )}

          {area && <path d={area} fill="var(--acento)" opacity={0.1} />}
          <path d={linea} fill="none" stroke="var(--acento)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {sel && <line x1={sel.x} x2={sel.x} y1={M.arriba} y2={M.arriba + altoPlot} stroke="var(--texto-3)" strokeWidth={1} />}

          {coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={i === activo ? 6 : 4} fill="var(--acento)" stroke="var(--sup)" strokeWidth={2} />
          ))}

          {/* Valor al final de la línea; el resto va en el toque y en la tabla. */}
          {activo == null && (
            <text x={ultimo.x + 8} y={ultimo.y} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--texto)">
              {formatoKg(ultimo.p.valor)}
            </text>
          )}
        </svg>
      )}

      {sel && (
        <div
          className="pointer-events-none absolute rounded-lg border border-borde bg-sup px-2.5 py-1.5 shadow-md"
          style={{
            left: Math.min(Math.max(sel.x - 50, 0), Math.max(0, ancho - 100)),
            // Arriba del punto; si no entra, abajo, para no tapar la marca.
            top: sel.y > 60 ? sel.y - 58 : sel.y + 12,
            width: 100,
          }}
        >
          <p className="text-base font-semibold tabular-nums leading-tight">{formatoKg(sel.p.valor)} kg</p>
          <p className="text-xs text-texto-3">{fechaCorta(sel.p.fecha)}</p>
        </div>
      )}
    </div>
  )
}

/** Mini línea para las filas del listado. */
export function Minilinea({ valores }: { valores: number[] }) {
  if (valores.length < 2) return <span className="inline-block w-16" />
  const w = 64
  const h = 24
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const d = valores
    .map((v, i) => {
      const x = 2 + (i / (valores.length - 1)) * (w - 4)
      const y = max === min ? h / 2 : 2 + (1 - (v - min) / (max - min)) * (h - 4)
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="var(--acento)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
