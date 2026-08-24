import { useMemo } from 'react'
import { assetUrl } from '../assetUrl'
import type { SaveGame } from '../db'
import { generateGarden, type GardenCellContent } from '../garden/gardenGenerator'
import {
  axialToPixel,
  HEX_DIRECTIONS,
  GARDEN_HEX_IDS,
  hexId,
  pointyHexCorners,
  type AxialHex,
  type HexPixel,
} from '../garden/hexGrid'
import { gardenHexStatus, type GardenHexStatus } from '../garden/gardenState'
import { GARDEN_HEIGHT, GARDEN_WIDTH } from '../data/mapLayout'

export type RevealPhase = Readonly<{
  id: string
  phase: 'clearing' | 'revealed'
}> | null

type HexGardenRendererProps = {
  save: SaveGame
  reveal: RevealPhase
  showCoordinates: boolean
  showBiomeIds: boolean
  onActivate: (id: string, status: GardenHexStatus) => void
}

type RenderCell = GardenCellContent & Readonly<{
  id: string
  center: HexPixel
  corners: HexPixel[]
  status: GardenHexStatus
}>

const HEX_SIZE = 40
const Y_SCALE = 0.76
const MAP_CENTER = { x: GARDEN_WIDTH / 2, y: GARDEN_HEIGHT / 2 + 12 }
const EDGE_CORNERS = [
  [0, 1],
  [5, 0],
  [4, 5],
  [3, 4],
  [2, 3],
  [1, 2],
] as const

function projectPoint(point: HexPixel): HexPixel {
  return { x: MAP_CENTER.x + point.x, y: MAP_CENTER.y + point.y * Y_SCALE }
}

function projectHex(hex: AxialHex): { center: HexPixel; corners: HexPixel[] } {
  const rawCenter = axialToPixel(hex, HEX_SIZE)
  return {
    center: projectPoint(rawCenter),
    corners: pointyHexCorners(rawCenter, HEX_SIZE + 0.65).map(projectPoint),
  }
}

function points(corners: readonly HexPixel[]): string {
  return corners.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
}

function rarityLabel(cell: GardenCellContent): string {
  if (cell.rarity === 'veryRare') return 'очень редкое'
  if (cell.rarity === 'rare') return 'редкое'
  return 'обычное'
}

function visibleLabel(cell: RenderCell): string {
  if (cell.status === 'hidden') return `Клетка ${cell.id}, скрыта`
  if (cell.status === 'available') return `Клетка ${cell.id}, доступна для расчистки`
  return `Клетка ${cell.id}, ${cell.biome.name}, ${rarityLabel(cell)} растение ${cell.plant.displayName}`
}

function cellFill(cell: RenderCell): string {
  if (cell.status === 'cleared') return cell.biome.groundStyle.fill
  if (cell.status === 'available') return '#48544a'
  return '#273833'
}

function edgePath(left: HexPixel, right: HexPixel): string {
  return `M ${left.x.toFixed(2)} ${left.y.toFixed(2)} L ${right.x.toFixed(2)} ${right.y.toFixed(2)}`
}

export function HexGardenRenderer({
  save,
  reveal,
  showCoordinates,
  showBiomeIds,
  onActivate,
}: HexGardenRendererProps) {
  const cells = useMemo(() => {
    const cleared = new Set(save.clearedHexes)
    return generateGarden(save.gardenSeed, save.gardenGenerationVersion).map((content): RenderCell => {
      const projected = projectHex(content.coordinate)
      return {
        ...content,
        ...projected,
        id: hexId(content.coordinate),
        status: gardenHexStatus(content.coordinate, cleared),
      }
    })
  }, [save.clearedHexes, save.gardenGenerationVersion, save.gardenSeed])
  const cellsById = useMemo(() => new Map(cells.map((cell) => [cell.id, cell])), [cells])
  const plants = useMemo(
    () => cells.filter((cell) => cell.status === 'cleared')
      .sort((left, right) => left.center.y - right.center.y || left.center.x - right.center.x),
    [cells],
  )

  return (
    <svg
      className="hex-garden-renderer"
      viewBox={`0 0 ${GARDEN_WIDTH} ${GARDEN_HEIGHT}`}
      role="group"
      aria-label="Гексагональная карта сада из 217 клеток"
    >
      <defs>
        <filter id="hex-soft-shadow" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#07100d" floodOpacity=".48" />
        </filter>
        <filter id="hex-rare-glint" x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f0d68b" floodOpacity=".34" />
        </filter>
        <radialGradient id="frontier-light">
          <stop offset="0" stopColor="#e8d79b" stopOpacity=".27" />
          <stop offset=".7" stopColor="#cbb978" stopOpacity=".08" />
          <stop offset="1" stopColor="#cbb978" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fog-wash" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#dce5d8" stopOpacity=".13" />
          <stop offset=".5" stopColor="#80948a" stopOpacity=".05" />
          <stop offset="1" stopColor="#101e1b" stopOpacity=".2" />
        </linearGradient>
      </defs>

      <g className="hex-island-shadow" filter="url(#hex-soft-shadow)">
        {cells.map((cell) => (
          <polygon key={cell.id} points={points(cell.corners)} fill="#101b17" />
        ))}
      </g>

      <g className="hex-terrain-layer">
        {cells.map((cell) => {
          const interactive = cell.status === 'cleared' || cell.status === 'available'
          const revealClass = reveal?.id === cell.id ? `is-${reveal.phase}` : ''
          return (
            <g
              className={`garden-hex is-${cell.status} ${revealClass} ${cell.status === 'available' && save.pendingClearActions > 0 ? 'has-clear-action' : ''}`}
              data-hex-id={cell.id}
              data-hex-status={cell.status}
              key={cell.id}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={visibleLabel(cell)}
              onClick={interactive ? () => onActivate(cell.id, cell.status) : undefined}
              onKeyDown={interactive ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onActivate(cell.id, cell.status)
              } : undefined}
            >
              <polygon className="hex-ground" points={points(cell.corners)} fill={cellFill(cell)} />
              {cell.status !== 'cleared' && (
                <polygon className="hex-fog" points={points(cell.corners)} fill="url(#fog-wash)" />
              )}
              {cell.status === 'available' && (
                <>
                  <ellipse
                    className="hex-frontier-light"
                    cx={cell.center.x}
                    cy={cell.center.y}
                    rx={HEX_SIZE * 0.8}
                    ry={HEX_SIZE * 0.54}
                    fill="url(#frontier-light)"
                  />
                  <path
                    className="hex-frontier-mark"
                    d={`M ${cell.center.x - 9} ${cell.center.y} H ${cell.center.x + 9} M ${cell.center.x} ${cell.center.y - 7} V ${cell.center.y + 7}`}
                  />
                </>
              )}
              {(showCoordinates || showBiomeIds) && (
                <text className="hex-debug-label" x={cell.center.x} y={cell.center.y + 4}>
                  {showCoordinates ? cell.id : ''}
                  {showCoordinates && showBiomeIds && cell.status === 'cleared' ? ' · ' : ''}
                  {showBiomeIds && cell.status === 'cleared' ? cell.biome.id.replace('biome-', 'B') : ''}
                </text>
              )}
            </g>
          )
        })}
      </g>

      <g className="hex-boundary-layer" aria-hidden="true">
        {cells.flatMap((cell) => HEX_DIRECTIONS.map((direction, directionIndex) => {
          const neighbor = {
            q: cell.coordinate.q + direction.q,
            r: cell.coordinate.r + direction.r,
          }
          const neighborId = hexId(neighbor)
          if (!GARDEN_HEX_IDS.has(neighborId)) return null
          if (cell.id > neighborId) return null
          const neighborCell = cellsById.get(neighborId)
          if (!neighborCell || cell.status !== 'cleared' || neighborCell.status !== 'cleared') return null
          if (neighborCell.biome.id === cell.biome.id) return null
          const cornerPair = EDGE_CORNERS[directionIndex]!
          const start = cell.corners[cornerPair[0]]!
          const end = cell.corners[cornerPair[1]]!
          const path = edgePath(start, end)
          return (
            <g className="hex-biome-fence" key={`${cell.id}:${neighborId}`}>
              <path d={path} className="hex-biome-fence-shadow" />
              <path d={path} className="hex-biome-fence-rail" />
              <circle cx={start.x} cy={start.y} r="2.4" />
              <circle cx={end.x} cy={end.y} r="2.4" />
            </g>
          )
        }))}
        {cells.flatMap((cell) => EDGE_CORNERS.map((cornerPair, directionIndex) => {
          const direction = HEX_DIRECTIONS[directionIndex]!
          const neighborId = hexId({
            q: cell.coordinate.q + direction.q,
            r: cell.coordinate.r + direction.r,
          })
          if (GARDEN_HEX_IDS.has(neighborId)) return null
          const start = cell.corners[cornerPair[0]]!
          const end = cell.corners[cornerPair[1]]!
          return <path className="hex-outer-border" d={edgePath(start, end)} key={`${cell.id}:outer:${directionIndex}`} />
        }))}
      </g>

      <g className="hex-plant-layer" aria-hidden="true">
        {plants.map((cell) => {
          const revealed = reveal?.id === cell.id && reveal.phase === 'revealed'
          return (
            <image
              className={`hex-plant is-${cell.rarity} ${revealed ? 'is-newly-revealed' : ''}`}
              data-plant-id={cell.plant.id}
              href={assetUrl(cell.plant.asset)}
              key={cell.id}
              x={cell.center.x - 47}
              y={cell.center.y - 77}
              width="94"
              height="94"
              preserveAspectRatio="xMidYMid meet"
              filter={cell.rarity === 'common' ? undefined : 'url(#hex-rare-glint)'}
            />
          )
        })}
      </g>
    </svg>
  )
}
