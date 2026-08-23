// PROTOTYPE — three looks at a 217-hex garden, switchable via ?variant=.
// Question: does a hexagonal garden feel better than the current 5×3 biome grid?
import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Eraser, Hand, RotateCcw, Shuffle, Sprout } from 'lucide-react'
import { PrototypeSwitcher, type PrototypeVariant } from './PrototypeSwitcher'
import './hexGardenPrototype.css'

const RADIUS = 8
const SQRT3 = Math.sqrt(3)
const HEX_COUNT = 3 * RADIUS * (RADIUS + 1) + 1
const VARIANTS = [
  { key: 'A' as const, name: 'Планшет' },
  { key: 'B' as const, name: 'Террасы' },
  { key: 'C' as const, name: 'Прогулка' },
]

type Axial = { q: number; r: number }
type Tool = { type: 'select' } | { type: 'erase' } | { type: 'plant'; id: string }
type Plant = { id: string; hanzi: string; name: string; ink: string; leaf: string; soil: string }

type HexMapProps = {
  size: number
  pointy: boolean
  planted: Map<string, string>
  selectedId: string | null
  neighborIds?: Set<string>
  paint: (hex: Axial, planted: Plant | undefined, selected: boolean) => { fill: string; stroke: string }
  lift?: (hex: Axial) => number
  showGlyph?: boolean
  showHanzi?: boolean
  onActivate: (id: string) => void
}

const PLANTS: Plant[] = [
  { id: 'bamboo', hanzi: '竹', name: 'Бамбук', ink: '#d7e8c4', leaf: '#7dba5a', soil: '#3f5a32' },
  { id: 'rice', hanzi: '稻', name: 'Рис', ink: '#f3e7a6', leaf: '#c8c05a', soil: '#5a5330' },
  { id: 'lotus', hanzi: '荷', name: 'Лотос', ink: '#f3d0dc', leaf: '#6fafa6', soil: '#2f4c4a' },
  { id: 'tea', hanzi: '茶', name: 'Чай', ink: '#dbe6b0', leaf: '#7a8f3d', soil: '#3d4528' },
  { id: 'sakura', hanzi: '樱', name: 'Сакура', ink: '#f7d0d8', leaf: '#e59aaa', soil: '#5a3a42' },
  { id: 'peony', hanzi: '牡丹', name: 'Пион', ink: '#f4c3d4', leaf: '#d4789a', soil: '#523040' },
  { id: 'chrysanthemum', hanzi: '菊', name: 'Хризантема', ink: '#f6e3a0', leaf: '#e0b44a', soil: '#544820' },
  { id: 'pine', hanzi: '松', name: 'Сосна', ink: '#c9ddc4', leaf: '#3d6a46', soil: '#243328' },
  { id: 'orchid', hanzi: '兰', name: 'Орхидея', ink: '#e3d2f0', leaf: '#9b7ab8', soil: '#3d304c' },
  { id: 'persimmon', hanzi: '柿', name: 'Хурма', ink: '#f5c39a', leaf: '#d4783c', soil: '#4c3220' },
]

const BIOME_NAMES = [
  'Бамбук', 'Рис', 'Лотос', 'Чай', 'Сакура',
  'Пионы', 'Хризантемы', 'Сосны', 'Хурма', 'Орхидеи',
  'Ягоды', 'Рапс', 'Пшеница', 'Глициния', 'Травы',
]

const BIOME_SOIL = [
  '#4d6a38', '#8a8440', '#3f6d68', '#5a6a32', '#8a5a66',
  '#7a4460', '#8a7230', '#2f4a36', '#8a4e28', '#5a4570',
  '#6a3040', '#8a7c34', '#7a6830', '#5a4870', '#3f5a40',
]

const RING_SOIL = ['#6d5a32', '#5d6a38', '#3f5c40', '#2f4c42', '#264040', '#1f363c', '#1a3036', '#16282e', '#121f24']

function hexId(hex: Axial): string {
  return `${hex.q},${hex.r}`
}

function parseHexId(id: string): Axial {
  const [q, r] = id.split(',').map(Number)
  return { q: q!, r: r! }
}

function createHexes(): Axial[] {
  const hexes: Axial[] = []
  for (let q = -RADIUS; q <= RADIUS; q += 1) {
    const rMin = Math.max(-RADIUS, -q - RADIUS)
    const rMax = Math.min(RADIUS, -q + RADIUS)
    for (let r = rMin; r <= rMax; r += 1) hexes.push({ q, r })
  }
  return hexes
}

const HEXES = createHexes()
const HEX_SET = new Set(HEXES.map(hexId))

function cubeDistance(hex: Axial): number {
  return (Math.abs(hex.q) + Math.abs(hex.r) + Math.abs(-hex.q - hex.r)) / 2
}

function biomeIndex(hex: Axial): number {
  if (hex.q === 0 && hex.r === 0) return 0
  const { x, y } = axialToPixel(hex, 1, true)
  const angle = Math.atan2(y, x)
  return Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 15) % 15
}

function axialToPixel(hex: Axial, size: number, pointy: boolean): { x: number; y: number } {
  if (pointy) return { x: size * (SQRT3 * hex.q + SQRT3 / 2 * hex.r), y: size * (1.5 * hex.r) }
  return { x: size * (1.5 * hex.q), y: size * (SQRT3 / 2 * hex.q + SQRT3 * hex.r) }
}

function hexPoints(cx: number, cy: number, size: number, pointy: boolean): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - (pointy ? 30 : 0))
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`
  }).join(' ')
}

function hexCorners(cx: number, cy: number, size: number, pointy: boolean): Array<{ x: number; y: number }> {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - (pointy ? 30 : 0))
    return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) }
  })
}

function mapViewBox(size: number, pointy: boolean, pad: number, extraBottom = 0): string {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const hex of HEXES) {
    const { x, y } = axialToPixel(hex, size, pointy)
    for (const corner of hexCorners(x, y, size, pointy)) {
      minX = Math.min(minX, corner.x)
      maxX = Math.max(maxX, corner.x)
      minY = Math.min(minY, corner.y)
      maxY = Math.max(maxY, corner.y)
    }
  }
  return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2 + extraBottom}`
}

function neighborIds(id: string): Set<string> {
  const hex = parseHexId(id)
  const next = new Set<string>()
  for (const dir of [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }]) {
    const neighbor = hexId({ q: hex.q + dir.q, r: hex.r + dir.r })
    if (HEX_SET.has(neighbor)) next.add(neighbor)
  }
  return next
}

function plantById(id: string | undefined): Plant | undefined {
  return PLANTS.find((plant) => plant.id === id)
}

function readVariant(): PrototypeVariant {
  const variant = new URLSearchParams(window.location.search).get('variant')
  return variant === 'B' || variant === 'C' ? variant : 'A'
}

function PlantArtwork({ plant }: { plant: Plant }) {
  return (
    <>
      {plant.id === 'bamboo' && (
        <>
          <path d="M16 42 V14 M24 42 V10 M32 42 V16" fill="none" stroke={plant.leaf} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M13 20h6M21 16h6M29 22h6M13 28h6M21 26h6M29 30h6" fill="none" stroke={plant.ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M16 12c-5-4-7-1-7 2M32 14c5-4 8-1 7 3" fill="none" stroke={plant.leaf} strokeWidth="2.2" />
        </>
      )}
      {plant.id === 'rice' && (
        <>
          <path d="M24 42 V18" fill="none" stroke="#8a7a40" strokeWidth="2.2" />
          <path d="M24 20c-8-8-14-4-14 2M24 20c8-8 14-4 14 2M24 26c-9-6-12-1-10 4M24 26c9-6 12-1 10 4" fill="none" stroke={plant.leaf} strokeWidth="2.3" />
        </>
      )}
      {plant.id === 'lotus' && (
        <>
          <ellipse cx="24" cy="36" rx="16" ry="5" fill="#3d6a4a" opacity=".7" />
          <path d="M24 34c-8-2-12-10-8-16 4 3 8 4 8 4s4-1 8-4c4 6 0 14-8 16z" fill={plant.leaf} />
          <circle cx="24" cy="22" r="3.2" fill="#f0d56a" />
        </>
      )}
      {plant.id === 'tea' && (
        <>
          <path d="M24 40c-11-2-14-14-8-22 6-3 8 2 8 2s2-5 8-2c6 8 3 20-8 22z" fill={plant.leaf} />
          <path d="M18 24c2-6 6-8 8-8 2 0 6 2 8 8" fill="none" stroke={plant.ink} strokeWidth="1.6" />
        </>
      )}
      {plant.id === 'sakura' && (
        <>
          <path d="M12 38c8-10 14-8 24-22" fill="none" stroke="#8a6a48" strokeWidth="2.4" />
          <circle cx="18" cy="22" r="4.2" fill={plant.leaf} />
          <circle cx="28" cy="16" r="4.6" fill={plant.leaf} />
          <circle cx="34" cy="24" r="3.6" fill={plant.leaf} />
          <circle cx="18" cy="22" r="1.3" fill="#f7e6b0" />
          <circle cx="28" cy="16" r="1.4" fill="#f7e6b0" />
        </>
      )}
      {plant.id === 'peony' && (
        <>
          <path d="M24 40 V28" fill="none" stroke="#4a6a3a" strokeWidth="2.4" />
          <circle cx="24" cy="20" r="11" fill={plant.leaf} />
          <circle cx="18" cy="18" r="6" fill="#f0b3c6" />
          <circle cx="30" cy="19" r="6" fill="#e89ab0" />
          <circle cx="24" cy="16" r="5" fill="#f7d0dc" />
          <circle cx="24" cy="20" r="2.4" fill="#f0d56a" />
        </>
      )}
      {plant.id === 'chrysanthemum' && (
        <>
          <path d="M24 40 V28" fill="none" stroke="#5a6a32" strokeWidth="2.2" />
          {Array.from({ length: 10 }, (_, index) => {
            const angle = (Math.PI / 5) * index
            return <ellipse key={index} cx={24 + Math.cos(angle) * 6} cy={18 + Math.sin(angle) * 6} rx="3.2" ry="7" transform={`rotate(${index * 36} 24 18)`} fill={plant.leaf} />
          })}
          <circle cx="24" cy="18" r="3" fill="#f7f0c4" />
        </>
      )}
      {plant.id === 'pine' && (
        <>
          <path d="M24 42 V30" fill="none" stroke="#6a5030" strokeWidth="3" />
          <path d="M24 12 L34 24 H14 Z" fill={plant.leaf} />
          <path d="M24 18 L36 32 H12 Z" fill="#2f5a3a" />
          <path d="M24 24 L37 38 H11 Z" fill="#245034" />
        </>
      )}
      {plant.id === 'orchid' && (
        <>
          <path d="M22 42 C18 28 28 24 26 10" fill="none" stroke="#5a6a40" strokeWidth="2" />
          <ellipse cx="20" cy="16" rx="6" ry="3.4" transform="rotate(-30 20 16)" fill={plant.leaf} />
          <ellipse cx="30" cy="18" rx="6" ry="3.4" transform="rotate(28 30 18)" fill="#c4a0d8" />
          <ellipse cx="26" cy="12" rx="4.4" ry="6" fill="#f0e4f7" />
        </>
      )}
      {plant.id === 'persimmon' && (
        <>
          <path d="M16 38 C20 24 30 22 34 14" fill="none" stroke="#6a5030" strokeWidth="2.4" />
          <circle cx="22" cy="22" r="6.2" fill={plant.leaf} />
          <circle cx="32" cy="18" r="5.4" fill="#e86a28" />
          <path d="M20 17h4M30 14h4" fill="none" stroke="#3d5a32" strokeWidth="1.6" />
        </>
      )}
    </>
  )
}

function PlantGlyph({ plant, className }: { plant: Plant; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <PlantArtwork plant={plant} />
    </svg>
  )
}

function HexMap({ size, pointy, planted, selectedId, neighborIds: neighbors, paint, lift, showGlyph = true, showHanzi = true, onActivate }: HexMapProps) {
  const extra = lift ? 18 : 0
  const drawn = useMemo(() => {
    const list = HEXES.map((hex) => {
      const center = axialToPixel(hex, size, pointy)
      return { hex, id: hexId(hex), ...center, depth: lift?.(hex) ?? 0 }
    })
    return lift ? list.sort((left, right) => left.y - right.y || left.x - right.x) : list
  }, [lift, pointy, size])

  return (
    <svg className="hex-garden-svg" viewBox={mapViewBox(size, pointy, size * 0.7, extra)} role="group" aria-label="Гексагональный сад">
      {drawn.map(({ hex, id, x, y, depth }) => {
        const plant = plantById(planted.get(id))
        const selected = selectedId === id
        const neighbor = neighbors?.has(id) ?? false
        const colors = paint(hex, plant, selected)
        const top = hexPoints(x, y, size - 1.1, pointy)
        const label = `${hex.q},${hex.r}${plant ? `, ${plant.name}` : ', пусто'}`
        return (
          <g
            key={id}
            className={`hex-cell ${selected ? 'is-selected' : ''} ${neighbor ? 'is-neighbor' : ''} ${plant ? 'is-planted' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onActivate(id)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onActivate(id) } }}
          >
            {depth > 0 && hexCorners(x, y, size - 1.1, pointy).slice(1, 4).map((corner, index, faces) => {
              const next = faces[index + 1] ?? hexCorners(x, y, size - 1.1, pointy)[4]!
              return (
                <polygon
                  key={index}
                  className="hex-wall"
                  points={`${corner.x},${corner.y} ${next.x},${next.y} ${next.x},${next.y + depth} ${corner.x},${corner.y + depth}`}
                  fill={index === 1 ? 'rgba(0,0,0,.34)' : 'rgba(0,0,0,.22)'}
                />
              )
            })}
            <polygon className="hex-face" points={top} fill={colors.fill} stroke={colors.stroke} />
            {plant && showGlyph && (
              <g className="hex-plant" transform={`translate(${x} ${y - (showHanzi ? size * 0.16 : size * 0.04)}) scale(${size / 36}) translate(-24 -26)`}>
                <PlantArtwork plant={plant} />
              </g>
            )}
            {plant && showHanzi && (
              <text className="hex-hanzi" x={x} y={y + size * (showGlyph ? 0.46 : 0.16)} fontSize={size * (showGlyph ? 0.36 : 0.58)}>{plant.hanzi}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Catalog({
  tool,
  compact,
  onTool,
}: {
  tool: Tool
  compact?: boolean
  onTool: (tool: Tool) => void
}) {
  return (
    <div className={`hex-catalog ${compact ? 'is-compact' : ''}`}>
      <button type="button" className={tool.type === 'select' ? 'is-active' : ''} title="Выбрать" onClick={() => onTool({ type: 'select' })}>
        <Hand size={16} />
        <span>Выбрать</span>
      </button>
      <button type="button" className={tool.type === 'erase' ? 'is-active' : ''} title="Выкорчевать" onClick={() => onTool({ type: 'erase' })}>
        <Eraser size={16} />
        <span>Выкорчевать</span>
      </button>
      {PLANTS.map((plant) => (
        <button
          key={plant.id}
          type="button"
          className={tool.type === 'plant' && tool.id === plant.id ? 'is-active' : ''}
          style={{ '--plant-soil': plant.soil, '--plant-ink': plant.ink } as CSSProperties}
          title={plant.name}
          onClick={() => onTool({ type: 'plant', id: plant.id })}
        >
          <PlantGlyph plant={plant} />
          <b>{plant.hanzi}</b>
          <span>{plant.name}</span>
        </button>
      ))}
    </div>
  )
}

function StateStrip({
  planted,
  selectedId,
  tool,
  extra,
  onScatter,
  onReset,
}: {
  planted: Map<string, string>
  selectedId: string | null
  tool: Tool
  extra?: string
  onScatter: () => void
  onReset: () => void
}) {
  const selected = selectedId ? parseHexId(selectedId) : null
  const selectedPlant = selectedId ? plantById(planted.get(selectedId)) : undefined
  const toolLabel = tool.type === 'plant' ? plantById(tool.id)?.name : tool.type === 'erase' ? 'Выкорчевать' : 'Выбрать'
  return (
    <aside className="hex-state">
      <dl>
        <div><dt>Гексов</dt><dd>{HEX_COUNT}</dd></div>
        <div><dt>Посажено</dt><dd>{planted.size}</dd></div>
        <div><dt>Активный</dt><dd>{selected ? `${selected.q}, ${selected.r}` : '—'}</dd></div>
        <div><dt>На нём</dt><dd>{selectedPlant?.name ?? 'пусто'}</dd></div>
        <div><dt>Инструмент</dt><dd>{toolLabel}</dd></div>
        {extra && <div><dt>Слой</dt><dd>{extra}</dd></div>}
      </dl>
      <div className="hex-state-actions">
        <button type="button" onClick={onScatter}><Shuffle size={15} /> Разбросать</button>
        <button type="button" onClick={onReset}><RotateCcw size={15} /> Сбросить</button>
      </div>
    </aside>
  )
}

export function HexGardenPrototype() {
  const [variant, setVariant] = useState<PrototypeVariant>(readVariant)
  const [tool, setTool] = useState<Tool>({ type: 'select' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [planted, setPlanted] = useState<Map<string, string>>(() => new Map())
  const skipClick = useRef(false)
  const drag = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0, zoom: 1 })

  const changeVariant = useCallback((next: PrototypeVariant) => {
    const search = new URLSearchParams(window.location.search)
    search.set('variant', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${search}`)
    setVariant(next)
  }, [])

  const activate = useCallback((id: string) => {
    if (skipClick.current) return
    setSelectedId(id)
    setPlanted((current) => {
      if (tool.type === 'select') return current
      const next = new Map(current)
      if (tool.type === 'erase') next.delete(id)
      else next.set(id, tool.id)
      return next
    })
  }, [tool])

  const scatter = useCallback(() => {
    const next = new Map<string, string>()
    for (const hex of HEXES) {
      if (Math.random() < 0.38) next.set(hexId(hex), PLANTS[Math.floor(Math.random() * PLANTS.length)]!.id)
    }
    setPlanted(next)
  }, [])

  const neighbors = useMemo(() => (selectedId ? neighborIds(selectedId) : new Set<string>()), [selectedId])
  const selectedHex = selectedId ? parseHexId(selectedId) : null
  const selectedPlant = selectedId ? plantById(planted.get(selectedId)) : undefined

  return (
    <main className={`hex-garden-prototype hex-variant-${variant.toLowerCase()}`}>
      {variant === 'A' && (
        <>
          <section className="hex-sheet">
            <header>
              <span><Sprout size={14} /> Только прототип</span>
              <h1>Планшет садовника</h1>
              <p>Плоская доска из {HEX_COUNT} гексов. Выберите растение слева и ткните в клетку — или оставьте «Выбрать», чтобы только подсветить грядку.</p>
            </header>
            <Catalog tool={tool} onTool={setTool} />
            <StateStrip planted={planted} selectedId={selectedId} tool={tool} onScatter={scatter} onReset={() => { setPlanted(new Map()); setSelectedId(null) }} />
          </section>
          <section className="hex-board hex-board-a">
            <HexMap
              size={22}
              pointy={false}
              planted={planted}
              selectedId={selectedId}
              paint={(_hex, plant, selected) => ({
                fill: plant?.soil ?? '#3d4d40',
                stroke: selected ? '#f0d59a' : 'rgba(235,220,170,.22)',
              })}
              onActivate={activate}
            />
          </section>
        </>
      )}

      {variant === 'B' && (
        <>
          <section className="hex-seals">
            <span>Семена</span>
            <Catalog tool={tool} compact onTool={setTool} />
          </section>
          <section className="hex-board hex-board-b">
            <HexMap
              size={24}
              pointy
              planted={planted}
              selectedId={selectedId}
              lift={(hex) => 5 + cubeDistance(hex) * 1.15}
              showGlyph={false}
              paint={(hex, plant, selected) => ({
                fill: plant?.soil ?? BIOME_SOIL[biomeIndex(hex)]!,
                stroke: selected ? '#f6e2a8' : 'rgba(8,16,12,.45)',
              })}
              onActivate={activate}
            />
          </section>
          <div className="hex-floating-state">
            <p>15 клиньев-биомов на круглой карте. Высота — кольцо от центра.</p>
            <StateStrip
              planted={planted}
              selectedId={selectedId}
              tool={tool}
              extra={selectedHex ? BIOME_NAMES[biomeIndex(selectedHex)] : '15 биомов'}
              onScatter={scatter}
              onReset={() => { setPlanted(new Map()); setSelectedId(null) }}
            />
          </div>
        </>
      )}

      {variant === 'C' && (
        <>
          <section className="hex-rail">
            <Catalog tool={tool} compact onTool={setTool} />
          </section>
          <section
            className={`hex-board hex-board-c ${dragging ? 'is-dragging' : ''}`}
            onPointerDown={(event) => {
              drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const current = drag.current
              if (!current || current.pointerId !== event.pointerId) return
              const dx = event.clientX - current.x
              const dy = event.clientY - current.y
              if (!current.moved && Math.hypot(dx, dy) < 8) return
              current.moved = true
              skipClick.current = true
              setDragging(true)
              setPan((value) => ({ ...value, x: current.panX + dx, y: current.panY + dy }))
            }}
            onPointerUp={() => {
              const moved = drag.current?.moved ?? false
              drag.current = null
              setDragging(false)
              if (moved) window.setTimeout(() => { skipClick.current = false }, 0)
              else skipClick.current = false
            }}
            onWheel={(event) => {
              setPan((value) => ({ ...value, zoom: Math.min(2.8, Math.max(0.45, value.zoom * (event.deltaY > 0 ? 0.9 : 1.12))) }))
            }}
          >
            <div className="hex-pan-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.zoom})` }}>
              <HexMap
                size={30}
                pointy
                planted={planted}
                selectedId={selectedId}
                neighborIds={neighbors}
                showHanzi={false}
                paint={(hex, plant, selected) => {
                  const ring = RING_SOIL[cubeDistance(hex)] ?? RING_SOIL.at(-1)!
                  return {
                    fill: plant?.soil ?? ring,
                    stroke: selected ? '#f0d59a' : neighbors.has(hexId(hex)) ? 'rgba(240,213,154,.55)' : 'rgba(255,255,255,.06)',
                  }
                }}
                onActivate={activate}
              />
            </div>
          </section>
          <article className="hex-inspector">
            <header>
              <span>Клетка</span>
              <strong>{selectedHex ? `${selectedHex.q}, ${selectedHex.r}` : 'не выбрана'}</strong>
            </header>
            <p>
              {selectedPlant ? `Растёт ${selectedPlant.hanzi} ${selectedPlant.name}` : 'Пустая земля'}
              {selectedHex ? ` · кольцо ${cubeDistance(selectedHex)} · соседей ${neighbors.size}` : ''}
            </p>
            <StateStrip planted={planted} selectedId={selectedId} tool={tool} extra="панорама" onScatter={scatter} onReset={() => { setPlanted(new Map()); setSelectedId(null); setPan({ x: 0, y: 0, zoom: 1 }) }} />
          </article>
        </>
      )}

      <PrototypeSwitcher current={variant} onChange={changeVariant} variants={VARIANTS} />
    </main>
  )
}
