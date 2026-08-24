import { useMemo, useRef, useState } from 'react'
import { assetUrl } from '../assetUrl'
import type { BedDefinition } from '../data/model'
import { GARDEN_HEIGHT, GARDEN_WIDTH } from '../data/mapLayout'
import { HEX_BIOMES, plantById, requireBiome } from './biomeRegistry'
import { hexContent } from './gardenGenerator'
import {
  availableHexIds,
  canClearHex,
  clearedHexSet,
  hexVisibility,
} from './gardenState'
import { gardenHexes, hasHex, hexId, type Axial } from './hexGrid'
import {
  axialToPixel,
  HEX_SIZE,
  hexEdge,
  hexPoints,
  neighborInDirection,
  pixelToAxial,
} from './hexMath'
import './hexGarden.css'

export type HexGardenOverlayProps = {
  gardenSeed: string
  gardenGenerationVersion: number
  clearedHexes: readonly string[]
  pendingClearActions: number
  studyBed: BedDefinition | undefined
  debug?: HexGardenDebugState
  gridVisible?: boolean
  onClearHex: (hex: Axial) => void
  onEnterStudy: (bed: BedDefinition) => void
}

export type HexGardenDebugState = {
  revealAll: boolean
  showCoordinates: boolean
  showBiomeIds: boolean
}

const FOG_FILL = '#2a3530'
const FOG_STROKE = 'rgba(220, 205, 160, .14)'
const AVAILABLE_STROKE = '#e7c56a'
const FENCE_COLOR = '#cbb48a'

export function HexGardenOverlay({
  gardenSeed,
  gardenGenerationVersion,
  clearedHexes,
  pendingClearActions,
  studyBed,
  debug,
  gridVisible = false,
  onClearHex,
  onEnterStudy,
}: HexGardenOverlayProps) {
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const cleared = useMemo(() => clearedHexSet(clearedHexes), [clearedHexes])
  const available = useMemo(() => new Set(availableHexIds(cleared)), [cleared])
  const revealAll = debug?.revealAll ?? false

  const drawn = useMemo(() => {
    return gardenHexes().map((hex) => {
      const center = axialToPixel(hex)
      return { hex, id: hexId(hex), ...center }
    }).sort((left, right) => left.y - right.y || left.x - right.x)
  }, [])

  const drag = useRef<{ x: number; y: number } | null>(null)

  const activate = (hex: Axial) => {
    const id = hexId(hex)
    if (canClearHex(cleared, pendingClearActions, hex)) {
      setRevealingId(id)
      window.setTimeout(() => {
        onClearHex(hex)
        setRevealingId((current) => current === id ? null : current)
      }, 280)
      return
    }
    if (hexVisibility(cleared, hex) === 'cleared' && studyBed) onEnterStudy(studyBed)
  }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, y: event.clientY }
  }

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = drag.current
    drag.current = null
    if (event.button !== 0 || !start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * GARDEN_WIDTH
    const y = (event.clientY - rect.top) / rect.height * GARDEN_HEIGHT
    const hex = pixelToAxial(x, y)
    if (!hasHex(hex)) return
    activate(hex)
  }

  return (
    <svg
      className={`hex-garden-overlay ${gridVisible ? 'is-grid' : ''}`}
      viewBox={`0 0 ${GARDEN_WIDTH} ${GARDEN_HEIGHT}`}
      aria-label="Гексагональный сад"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {drawn.map(({ hex, id, x, y }) => {
        const visibility = hexVisibility(cleared, hex)
        const known = revealAll || visibility === 'cleared' || revealingId === id
        const content = known ? hexContent(gardenSeed, hex, gardenGenerationVersion) : null
        const biome = content ? requireBiome(content.biomeId) : null
        const plant = content ? plantById.get(content.plantId) : undefined
        const isAvailable = available.has(id) && pendingClearActions > 0
        const fill = known && biome
          ? ((hex.q + hex.r) & 1 ? biome.groundStyle.fillAlt : biome.groundStyle.fill)
          : FOG_FILL
        const stroke = isAvailable ? AVAILABLE_STROKE : known && biome ? biome.groundStyle.stroke : FOG_STROKE
        const label = known && plant
          ? `${biome?.name}, ${plant.displayName}`
          : isAvailable
            ? 'Можно расчистить'
            : 'Скрытая клетка'
        return (
          <g
            key={id}
            className={[
              'hex-garden-cell',
              `is-${visibility}`,
              isAvailable ? 'is-frontier' : '',
              revealingId === id ? 'is-revealing' : '',
              known ? 'is-known' : 'is-fogged',
            ].filter(Boolean).join(' ')}
            data-hex-id={id}
            data-bed-id={id === '0,0' && visibility === 'cleared' && studyBed ? studyBed.id : undefined}
            pointerEvents="none"
          >
            <polygon
              className="hex-garden-ground"
              points={hexPoints(x, y, HEX_SIZE + 0.35)}
              fill={fill}
              stroke={stroke}
            />
            {isAvailable && !known && (
              <polygon
                className="hex-garden-available"
                points={hexPoints(x, y, HEX_SIZE - 3)}
                fill="none"
              />
            )}
            {known && plant && (
              <image
                className={`hex-garden-plant is-${plant.rarity}`}
                href={assetUrl(plant.asset)}
                x={x - HEX_SIZE * 0.72}
                y={y - HEX_SIZE * 1.05}
                width={HEX_SIZE * 1.44}
                height={HEX_SIZE * 1.44}
              />
            )}
            {debug?.showCoordinates && (
              <text className="hex-garden-debug" x={x} y={y - 2}>{hex.q},{hex.r}</text>
            )}
            {debug?.showBiomeIds && biome && (
              <text className="hex-garden-debug is-biome" x={x} y={y + 10}>{biome.culture}</text>
            )}
            <title>{label}</title>
          </g>
        )
      })}
      {drawn.flatMap(({ hex, id }) => {
        const visibility = hexVisibility(cleared, hex)
        if (!revealAll && visibility !== 'cleared' && revealingId !== id) return []
        const content = hexContent(gardenSeed, hex, gardenGenerationVersion)
        return [0, 1, 2, 3, 4, 5].flatMap((direction) => {
          const neighbor = neighborInDirection(hex, direction)
          const neighborId = hexId(neighbor)
          if (!hasHex(neighbor)) {
            const edge = hexEdge(hex, direction, HEX_SIZE - 0.2)
            return (
              <line
                key={`${id}:rim:${direction}`}
                className="hex-garden-rim"
                x1={edge.a.x}
                y1={edge.a.y}
                x2={edge.b.x}
                y2={edge.b.y}
              />
            )
          }
          const neighborVisible = revealAll || hexVisibility(cleared, neighbor) === 'cleared'
          if (!neighborVisible) return []
          if (id >= neighborId) return []
          const neighborContent = hexContent(gardenSeed, neighbor, gardenGenerationVersion)
          if (neighborContent.biomeId === content.biomeId) return []
          const edge = hexEdge(hex, direction, HEX_SIZE - 0.6)
          return (
            <line
              key={`${id}:fence:${direction}`}
              className="hex-garden-fence"
              x1={edge.a.x}
              y1={edge.a.y}
              x2={edge.b.x}
              y2={edge.b.y}
              stroke={FENCE_COLOR}
            />
          )
        })
      })}
    </svg>
  )
}

export const HEX_BIOME_COUNT = HEX_BIOMES.length
