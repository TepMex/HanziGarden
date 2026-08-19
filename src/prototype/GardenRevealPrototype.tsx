// PROTOTYPE — three views of the garden reveal model, switchable via ?variant=.
// No save-game data or persistence is used on this route.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bug, Check, Eraser, Grid3X3, RotateCcw, Sparkles } from 'lucide-react'
import { assetUrl } from '../assetUrl'
import { PrototypeSwitcher, type PrototypeVariant } from './PrototypeSwitcher'
import './gardenRevealPrototype.css'

const WIDTH = 1600
const HEIGHT = 1200
const CLEANING_STEPS = 5
const GRID_URL = assetUrl('assets/garden-grid.svg')

type Point = { x: number; y: number }
type Bed = { id: string; biomeIndex: number; column: number; row: number; center: Point; points: string }
type Side = { id: string; label: string; seed: Point; adjacentBiome: number }
type Corner = { id: string; label: string; seed: Point; adjacentSides: [string, string] }
type RasterModel = {
  labels: Int16Array
  biomeLabels: number[]
  sideLabels: Map<string, number>
  cornerLabels: Map<string, number>
}
type ViewMode = 'map' | 'debug' | 'mask'

// Intersections measured from the supplied SVG at its native 4:3 aspect.
// Flood-fill follows the actual wavy SVG paths; these points only seed biomes
// and position the 3 x 5 clickable bed controls.
const intersections: Point[][] = [
  [{ x: 140, y: 134 }, { x: 434, y: 134 }, { x: 682, y: 149 }, { x: 929, y: 139 }, { x: 1158, y: 134 }, { x: 1460, y: 136 }],
  [{ x: 103, y: 435 }, { x: 416, y: 440 }, { x: 674, y: 455 }, { x: 939, y: 463 }, { x: 1178, y: 456 }, { x: 1516, y: 453 }],
  [{ x: 42, y: 732 }, { x: 393, y: 742 }, { x: 670, y: 752 }, { x: 942, y: 749 }, { x: 1207, y: 756 }, { x: 1537, y: 752 }],
  [{ x: 11, y: 1116 }, { x: 357, y: 1118 }, { x: 656, y: 1125 }, { x: 942, y: 1121 }, { x: 1242, y: 1103 }, { x: 1546, y: 1144 }],
]

const biomeNames = [
  'Бамбук', 'Рис', 'Лотос', 'Чай', 'Сакура',
  'Пионы', 'Хризантемы', 'Сосны', 'Хурма', 'Орхидеи',
  'Ягоды', 'Рапс', 'Пшеница', 'Глициния', 'Травы',
]

function mix(left: Point, right: Point, amount: number): Point {
  return { x: left.x + (right.x - left.x) * amount, y: left.y + (right.y - left.y) * amount }
}

function biomeCorners(index: number): [Point, Point, Point, Point] {
  const row = Math.floor(index / 5)
  const column = index % 5
  return [
    intersections[row]![column]!, intersections[row]![column + 1]!,
    intersections[row + 1]![column + 1]!, intersections[row + 1]![column]!,
  ]
}

function quadPoint(corners: [Point, Point, Point, Point], x: number, y: number): Point {
  return mix(mix(corners[0], corners[1], x), mix(corners[3], corners[2], x), y)
}

function createBeds(): Bed[] {
  return biomeNames.flatMap((_, biomeIndex) => {
    const columns = biomeIndex === 0 ? 2 : 3
    const corners = biomeCorners(biomeIndex)
    return Array.from({ length: columns * 5 }, (_, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const left = column / columns
      const right = (column + 1) / columns
      const top = row / 5
      const bottom = (row + 1) / 5
      const points = [
        quadPoint(corners, left, top), quadPoint(corners, right, top),
        quadPoint(corners, right, bottom), quadPoint(corners, left, bottom),
      ]
      return {
        id: `biome-${biomeIndex + 1}-bed-${index + 1}`,
        biomeIndex,
        column,
        row,
        center: quadPoint(corners, (left + right) / 2, (top + bottom) / 2),
        points: points.map((point) => `${point.x},${point.y}`).join(' '),
      }
    })
  })
}

const beds = createBeds()
const bedsByBiome = biomeNames.map((_, biomeIndex) => beds.filter((bed) => bed.biomeIndex === biomeIndex))

const sides: Side[] = [
  ...Array.from({ length: 5 }, (_, column): Side => ({
    id: `top-${column + 1}`,
    label: `Север ${column + 1}`,
    seed: mix({ x: intersections[0]![column]!.x, y: 10 }, { x: intersections[0]![column + 1]!.x, y: 10 }, .5),
    adjacentBiome: column,
  })),
  ...Array.from({ length: 5 }, (_, column): Side => ({
    id: `bottom-${column + 1}`,
    label: `Юг ${column + 1}`,
    seed: { x: (intersections[3]![column]!.x + intersections[3]![column + 1]!.x) / 2, y: 1184 },
    adjacentBiome: 10 + column,
  })),
  ...Array.from({ length: 3 }, (_, row): Side => ({
    id: `left-${row + 1}`,
    label: `Запад ${row + 1}`,
    seed: { x: Math.max(8, Math.min(intersections[row]![0]!.x, intersections[row + 1]![0]!.x) / 2), y: (intersections[row]![0]!.y + intersections[row + 1]![0]!.y) / 2 },
    adjacentBiome: row * 5,
  })),
  ...Array.from({ length: 3 }, (_, row): Side => ({
    id: `right-${row + 1}`,
    label: `Восток ${row + 1}`,
    seed: { x: (Math.max(intersections[row]![5]!.x, intersections[row + 1]![5]!.x) + WIDTH) / 2, y: (intersections[row]![5]!.y + intersections[row + 1]![5]!.y) / 2 },
    adjacentBiome: row * 5 + 4,
  })),
]

const corners: Corner[] = [
  { id: 'top-left', label: 'Северо-запад', seed: { x: 12, y: 12 }, adjacentSides: ['top-1', 'left-1'] },
  { id: 'top-right', label: 'Северо-восток', seed: { x: WIDTH - 12, y: 12 }, adjacentSides: ['top-5', 'right-1'] },
  { id: 'bottom-left', label: 'Юго-запад', seed: { x: 12, y: HEIGHT - 12 }, adjacentSides: ['bottom-1', 'left-3'] },
  { id: 'bottom-right', label: 'Юго-восток', seed: { x: WIDTH - 12, y: HEIGHT - 12 }, adjacentSides: ['bottom-5', 'right-3'] },
]

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Не удалось загрузить ${url}`))
    image.src = url
  })
}

function floodLabel(blocked: Uint8Array, labels: Int16Array, seed: Point, label: number): number {
  const startX = Math.max(0, Math.min(WIDTH - 1, Math.round(seed.x)))
  const startY = Math.max(0, Math.min(HEIGHT - 1, Math.round(seed.y)))
  const start = startY * WIDTH + startX
  if (blocked[start] || labels[start] >= 0) return labels[start] ?? -1

  const queue = new Int32Array(WIDTH * HEIGHT)
  let head = 0
  let tail = 0
  queue[tail++] = start
  labels[start] = label

  while (head < tail) {
    const offset = queue[head++]!
    const x = offset % WIDTH
    const candidates = [offset - WIDTH, offset + WIDTH, offset - 1, offset + 1]
    for (let index = 0; index < candidates.length; index += 1) {
      if ((index === 2 && x === 0) || (index === 3 && x === WIDTH - 1)) continue
      const next = candidates[index]!
      if (next < 0 || next >= labels.length || blocked[next] || labels[next] >= 0) continue
      labels[next] = label
      queue[tail++] = next
    }
  }
  return label
}

function buildRasterModel(grid: HTMLImageElement): RasterModel {
  const boundary = document.createElement('canvas')
  boundary.width = WIDTH
  boundary.height = HEIGHT
  const context = boundary.getContext('2d', { willReadFrequently: true })!
  // Thicken only the invisible analysis copy. The hand-traced SVG has a few
  // sub-pixel gaps at intersections; sealing them keeps adjacent flood-fill
  // biomes independent while the visible overlay remains untouched.
  for (let y = -5; y <= 5; y += 1) {
    for (let x = -5; x <= 5; x += 1) context.drawImage(grid, x, y, WIDTH, HEIGHT)
  }
  // Close the perimeter seams against the canvas frame. The source trace
  // intentionally runs beyond the artwork in places, so its cropped endpoints
  // are not guaranteed to touch the exact outer pixel.
  context.strokeStyle = '#000'
  context.lineWidth = 11
  context.beginPath()
  for (let column = 0; column < intersections[0]!.length; column += 1) {
    const top = intersections[0]![column]!
    const bottom = intersections[3]![column]!
    context.moveTo(top.x, top.y)
    context.lineTo(top.x, 0)
    context.moveTo(bottom.x, bottom.y)
    context.lineTo(bottom.x, HEIGHT)
  }
  for (let row = 0; row < intersections.length; row += 1) {
    const left = intersections[row]![0]!
    const right = intersections[row]![5]!
    context.moveTo(left.x, left.y)
    context.lineTo(0, left.y)
    context.moveTo(right.x, right.y)
    context.lineTo(WIDTH, right.y)
  }
  context.stroke()
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data
  const blocked = new Uint8Array(WIDTH * HEIGHT)
  for (let offset = 0; offset < blocked.length; offset += 1) blocked[offset] = pixels[offset * 4 + 3]! > 20 ? 1 : 0

  const labels = new Int16Array(WIDTH * HEIGHT)
  labels.fill(-1)
  const biomeLabels: number[] = []
  const sideLabels = new Map<string, number>()
  const cornerLabels = new Map<string, number>()
  let nextLabel = 0

  for (let biomeIndex = 0; biomeIndex < biomeNames.length; biomeIndex += 1) {
    const label = nextLabel++
    biomeLabels.push(floodLabel(blocked, labels, quadPoint(biomeCorners(biomeIndex), .5, .5), label))
  }
  for (const side of sides) {
    const existing = labels[Math.round(side.seed.y) * WIDTH + Math.round(side.seed.x)]!
    const label = existing >= 0 ? existing : floodLabel(blocked, labels, side.seed, nextLabel++)
    sideLabels.set(side.id, label)
  }
  for (const corner of corners) {
    const existing = labels[Math.round(corner.seed.y) * WIDTH + Math.round(corner.seed.x)]!
    const label = existing >= 0 ? existing : floodLabel(blocked, labels, corner.seed, nextLabel++)
    cornerLabels.set(corner.id, label)
  }
  return { labels, biomeLabels, sideLabels, cornerLabels }
}

function lineTouchesRevealedArea(
  offset: number,
  labels: Int16Array,
  revealedLabels: ReadonlySet<number>,
): boolean {
  const x = offset % WIDTH
  const y = Math.floor(offset / WIDTH)
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ]

  for (let radius = 3; radius <= 18; radius += 3) {
    for (const [directionX, directionY] of directions) {
      const sampleX = x + directionX! * radius
      const sampleY = y + directionY! * radius
      if (sampleX < 0 || sampleX >= WIDTH || sampleY < 0 || sampleY >= HEIGHT) continue
      if (revealedLabels.has(labels[sampleY * WIDTH + sampleX]!)) return true
    }
  }
  return false
}

function makeRevealLayer(
  cleanliness: ReadonlyMap<string, number>,
  completeBiomes: ReadonlySet<number>,
  exposedSides: ReadonlySet<string>,
  exposedCorners: ReadonlySet<string>,
  model: RasterModel,
): HTMLCanvasElement {
  const reveal = document.createElement('canvas')
  reveal.width = WIDTH
  reveal.height = HEIGHT
  const context = reveal.getContext('2d', { willReadFrequently: true })!

  for (const bed of beds) {
    const cleaningStep = cleanliness.get(bed.id) ?? 0
    if (cleaningStep === 0 || completeBiomes.has(bed.biomeIndex)) continue
    const revealAmount = cleaningStep / CLEANING_STEPS
    const biomeBeds = bedsByBiome[bed.biomeIndex]!
    const sibling = biomeBeds.find((candidate) => candidate.row === bed.row && candidate.column === bed.column + 1)
    const below = biomeBeds.find((candidate) => candidate.row === bed.row + 1 && candidate.column === bed.column)
    const radiusX = sibling ? Math.abs(sibling.center.x - bed.center.x) * .78 : 62
    const radiusY = below ? Math.abs(below.center.y - bed.center.y) * .9 : 46
    context.save()
    context.translate(bed.center.x, bed.center.y)
    context.scale(radiusX, radiusY)
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1)
    gradient.addColorStop(0, `rgba(0,0,0,${revealAmount})`)
    gradient.addColorStop(.58, `rgba(0,0,0,${revealAmount})`)
    gradient.addColorStop(.82, `rgba(0,0,0,${revealAmount * .55})`)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(-1, -1, 2, 2)
    context.restore()
  }

  const image = context.getImageData(0, 0, WIDTH, HEIGHT)
  const completeLabels = new Set([...completeBiomes].map((biomeIndex) => model.biomeLabels[biomeIndex]!))
  const exposedLabels = new Set([...exposedSides].map((sideId) => model.sideLabels.get(sideId)!))
  const exposedCornerLabels = new Set([...exposedCorners].map((cornerId) => model.cornerLabels.get(cornerId)!))
  const revealedLabels = new Set([...completeLabels, ...exposedLabels, ...exposedCornerLabels])
  const biomeLabelSet = new Set(model.biomeLabels)

  for (let offset = 0; offset < model.labels.length; offset += 1) {
    const label = model.labels[offset]!
    const alphaOffset = offset * 4 + 3
    if (revealedLabels.has(label)) image.data[alphaOffset] = 255
    else if (label < 0 && lineTouchesRevealedArea(offset, model.labels, revealedLabels)) image.data[alphaOffset] = 255
    else if (!biomeLabelSet.has(label)) image.data[alphaOffset] = 0
  }
  context.putImageData(image, 0, 0)
  return reveal
}

function RevealCanvas({
  cleanliness,
  completeBiomes,
  exposedSides,
  exposedCorners,
  model,
  mode,
}: {
  cleanliness: ReadonlyMap<string, number>
  completeBiomes: ReadonlySet<number>
  exposedSides: ReadonlySet<string>
  exposedCorners: ReadonlySet<string>
  model: RasterModel | null
  mode: ViewMode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !model) return
    let cancelled = false
    Promise.all([
      loadImage(assetUrl('assets/garden-map.webp')),
      loadImage(assetUrl('assets/garden-map_negative.webp')),
    ]).then(([clean, negative]) => {
      if (cancelled) return
      const context = canvas.getContext('2d')!
      const reveal = makeRevealLayer(cleanliness, completeBiomes, exposedSides, exposedCorners, model)
      context.clearRect(0, 0, WIDTH, HEIGHT)
      if (mode === 'mask') {
        context.fillStyle = '#f4f0e8'
        context.fillRect(0, 0, WIDTH, HEIGHT)
        context.globalCompositeOperation = 'destination-out'
        context.drawImage(reveal, 0, 0)
        context.globalCompositeOperation = 'destination-over'
        context.fillStyle = '#172c2b'
        context.fillRect(0, 0, WIDTH, HEIGHT)
        context.globalCompositeOperation = 'source-over'
        return
      }
      context.drawImage(clean, 0, 0, WIDTH, HEIGHT)
      const weedLayer = document.createElement('canvas')
      weedLayer.width = WIDTH
      weedLayer.height = HEIGHT
      const weedContext = weedLayer.getContext('2d')!
      weedContext.drawImage(negative, 0, 0, WIDTH, HEIGHT)
      weedContext.globalCompositeOperation = 'destination-out'
      weedContext.drawImage(reveal, 0, 0)
      context.drawImage(weedLayer, 0, 0)

      if (mode === 'debug') {
        const tint = document.createElement('canvas')
        tint.width = WIDTH
        tint.height = HEIGHT
        const tintContext = tint.getContext('2d')!
        const image = tintContext.createImageData(WIDTH, HEIGHT)
        const biomeLabels = new Set(model.biomeLabels)
        const sideLabels = new Set(model.sideLabels.values())
        const cornerLabels = new Set(model.cornerLabels.values())
        for (let offset = 0; offset < model.labels.length; offset += 1) {
          const label = model.labels[offset]!
          const pixel = offset * 4
          if (sideLabels.has(label) || cornerLabels.has(label)) {
            image.data[pixel] = 226
            image.data[pixel + 1] = 62
            image.data[pixel + 2] = 72
            image.data[pixel + 3] = 38
          } else if (biomeLabels.has(label)) {
            image.data[pixel] = 26
            image.data[pixel + 1] = 151
            image.data[pixel + 2] = 218
            image.data[pixel + 3] = 22
          }
        }
        tintContext.putImageData(image, 0, 0)
        context.drawImage(tint, 0, 0)
      }
    })
    return () => { cancelled = true }
  }, [cleanliness, completeBiomes, exposedCorners, exposedSides, mode, model])

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label={mode === 'mask' ? 'Чёрно-белая маска раскрытия' : 'Карта раскрытия сада'} />
}

function GardenStage({
  cleanliness,
  completeBiomes,
  exposedSides,
  exposedCorners,
  model,
  activeBiome,
  mode,
  onToggle,
}: {
  cleanliness: ReadonlyMap<string, number>
  completeBiomes: ReadonlySet<number>
  exposedSides: ReadonlySet<string>
  exposedCorners: ReadonlySet<string>
  model: RasterModel | null
  activeBiome: number
  mode: ViewMode
  onToggle: (bed: Bed) => void
}) {
  return (
    <div className={`prototype-garden-stage is-${mode}`}>
      <RevealCanvas cleanliness={cleanliness} completeBiomes={completeBiomes} exposedSides={exposedSides} exposedCorners={exposedCorners} model={model} mode={mode} />
      <img className="prototype-source-grid" src={GRID_URL} alt="" draggable={false} />
      <svg className="prototype-hit-grid" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Растения на грядках">
        {mode === 'debug' && sides.map((side) => {
          const label = model?.sideLabels.get(side.id)
          return <text key={side.id} className={exposedSides.has(side.id) ? 'side-label is-clear' : 'side-label'} x={side.seed.x} y={side.seed.y}>R{label ?? '…'}</text>
        })}
        {mode === 'debug' && corners.map((corner) => {
          const label = model?.cornerLabels.get(corner.id)
          const labelX = corner.seed.x + (corner.seed.x < WIDTH / 2 ? 18 : -18)
          const labelY = corner.seed.y + (corner.seed.y < HEIGHT / 2 ? 26 : -12)
          return <text key={corner.id} className={exposedCorners.has(corner.id) ? 'side-label is-clear' : 'side-label'} x={labelX} y={labelY}>C{label ?? '…'}</text>
        })}
        {beds.map((bed) => {
          const cleaningStep = cleanliness.get(bed.id) ?? 0
          const cleanlinessPercent = cleaningStep / CLEANING_STEPS * 100
          const isClear = cleaningStep === CLEANING_STEPS
          return (
            <g key={bed.id}>
              <polygon
                className={`prototype-bed ${isClear ? 'is-clear' : ''} ${bed.biomeIndex === activeBiome ? 'is-active-biome' : ''}`}
                points={bed.points}
                role="button"
                tabIndex={0}
                aria-label={`${biomeNames[bed.biomeIndex]}, растение ${bed.row * (bed.biomeIndex === 0 ? 2 : 3) + bed.column + 1}: ${cleanlinessPercent === 0 ? 'сорняки' : `очищено на ${cleanlinessPercent}%`}`}
                onClick={() => onToggle(bed)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onToggle(bed)
                  }
                }}
              />
              {(mode !== 'map' || isClear) && (
                <g className="bed-marker" transform={`translate(${bed.center.x} ${bed.center.y})`} aria-hidden="true">
                  <circle r={mode === 'map' ? 8 : 10} />
                  {isClear && <path d="M-4 0 -1.2 3 5 -4" />}
                </g>
              )}
            </g>
          )
        })}
        {mode === 'debug' && biomeNames.map((_, biomeIndex) => {
          const center = quadPoint(biomeCorners(biomeIndex), .5, .5)
          return <text className="biome-label" key={biomeIndex} x={center.x} y={center.y}>{biomeIndex + 1}</text>
        })}
      </svg>
      {!model && <div className="prototype-loading"><Sparkles /> Строю области из Garden.svg…</div>}
    </div>
  )
}

function StatePanel({
  cleanliness,
  completeBiomes,
  exposedSides,
  exposedCorners,
  activeBiome,
  activeBedId,
  onReset,
  onCompleteBiome,
}: {
  cleanliness: ReadonlyMap<string, number>
  completeBiomes: ReadonlySet<number>
  exposedSides: ReadonlySet<string>
  exposedCorners: ReadonlySet<string>
  activeBiome: number
  activeBedId: string
  onReset: () => void
  onCompleteBiome: () => void
}) {
  const activeBeds = bedsByBiome[activeBiome]!
  const activeBed = activeBeds.find((bed) => bed.id === activeBedId) ?? activeBeds[0]!
  const activeBedNumber = activeBed.row * (activeBed.biomeIndex === 0 ? 2 : 3) + activeBed.column + 1
  const activeCleanliness = (cleanliness.get(activeBed.id) ?? 0) / CLEANING_STEPS * 100
  const totalCleaningSteps = beds.reduce((total, bed) => total + (cleanliness.get(bed.id) ?? 0), 0)
  const totalCleanliness = Math.round(totalCleaningSteps / (beds.length * CLEANING_STEPS) * 1000) / 10
  return (
    <aside className="prototype-state-panel">
      <div className="prototype-eyebrow"><Bug size={15} /> Только визуальный прототип</div>
      <h1>Раскрытие сада</h1>
      <p>Каждый клик очищает грядку ещё на 20%. Пятый клик даёт 100%, шестой возвращает сорняки. Полностью очищенный биом раскрывает соседние внешние области и общие линии.</p>
      <div className="active-biome-card">
        <span>Активная клетка</span>
        <strong>{String(activeBiome + 1).padStart(2, '0')} · {biomeNames[activeBiome]} · {activeBedNumber}</strong>
        <div className="progress-row"><i style={{ width: `${activeCleanliness}%` }} /><span>{activeCleanliness}%</span></div>
      </div>
      <dl className="prototype-stats">
        <div><dt>Очищенность</dt><dd>{totalCleanliness}%</dd></div>
        <div><dt>Биомы</dt><dd>{completeBiomes.size}/15</dd></div>
        <div><dt>Боковые</dt><dd>{exposedSides.size}/16</dd></div>
        <div><dt>Углы</dt><dd>{exposedCorners.size}/4</dd></div>
      </dl>
      <div className="prototype-actions">
        <button type="button" onClick={onCompleteBiome}><Eraser size={17} /> Очистить биом</button>
        <button type="button" onClick={onReset}><RotateCcw size={17} /> Сбросить</button>
      </div>
      <div className="side-state-list">
        <b>Открытые боковые клетки</b>
        <span>{exposedSides.size ? [...exposedSides].join(' · ') : 'Пока нет'}</span>
        <b>Открытые углы</b>
        <span>{exposedCorners.size ? [...exposedCorners].join(' · ') : 'Пока нет'}</span>
      </div>
    </aside>
  )
}

function readVariant(): PrototypeVariant {
  const variant = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return variant === 'B' || variant === 'C' ? variant : 'A'
}

export function GardenRevealPrototype() {
  const [variant, setVariant] = useState<PrototypeVariant>(readVariant)
  const [cleanliness, setCleanliness] = useState<Map<string, number>>(() => new Map())
  const [activeBiome, setActiveBiome] = useState(0)
  const [activeBedId, setActiveBedId] = useState(beds[0]!.id)
  const [model, setModel] = useState<RasterModel | null>(null)

  useEffect(() => {
    loadImage(GRID_URL).then((grid) => setModel(buildRasterModel(grid)))
  }, [])

  const completeBiomes = useMemo(() => new Set(
    bedsByBiome.flatMap((biomeBeds, biomeIndex) => biomeBeds.every((bed) => cleanliness.get(bed.id) === CLEANING_STEPS) ? [biomeIndex] : []),
  ), [cleanliness])
  const exposedSides = useMemo(() => new Set(
    sides.filter((side) => completeBiomes.has(side.adjacentBiome)).map((side) => side.id),
  ), [completeBiomes])
  const exposedCorners = useMemo(() => new Set(
    corners
      .filter((corner) => corner.adjacentSides.every((sideId) => exposedSides.has(sideId)))
      .map((corner) => corner.id),
  ), [exposedSides])
  const activeBedCleanliness = (cleanliness.get(activeBedId) ?? 0) / CLEANING_STEPS * 100

  const changeVariant = useCallback((next: PrototypeVariant) => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState({}, '', url)
    setVariant(next)
  }, [])

  const toggleBed = useCallback((bed: Bed) => {
    setActiveBiome(bed.biomeIndex)
    setActiveBedId(bed.id)
    setCleanliness((current) => {
      const next = new Map(current)
      const nextStep = ((current.get(bed.id) ?? 0) + 1) % (CLEANING_STEPS + 1)
      if (nextStep === 0) next.delete(bed.id)
      else next.set(bed.id, nextStep)
      return next
    })
  }, [])

  const completeActiveBiome = useCallback(() => {
    setCleanliness((current) => {
      const next = new Map(current)
      const biomeBeds = bedsByBiome[activeBiome]!
      const shouldClear = !biomeBeds.every((bed) => current.get(bed.id) === CLEANING_STEPS)
      for (const bed of biomeBeds) {
        if (shouldClear) next.set(bed.id, CLEANING_STEPS)
        else next.delete(bed.id)
      }
      return next
    })
  }, [activeBiome])

  const statePanel = (
    <StatePanel
      cleanliness={cleanliness}
      completeBiomes={completeBiomes}
      exposedSides={exposedSides}
      exposedCorners={exposedCorners}
      activeBiome={activeBiome}
      activeBedId={activeBedId}
      onReset={() => setCleanliness(new Map())}
      onCompleteBiome={completeActiveBiome}
    />
  )

  return (
    <main className={`garden-reveal-prototype variant-${variant.toLowerCase()}`}>
      {variant === 'A' && (
        <>
          <GardenStage cleanliness={cleanliness} completeBiomes={completeBiomes} exposedSides={exposedSides} exposedCorners={exposedCorners} model={model} activeBiome={activeBiome} mode="map" onToggle={toggleBed} />
          <div className="map-floating-panel">{statePanel}</div>
        </>
      )}
      {variant === 'B' && (
        <div className="prototype-workbench">
          {statePanel}
          <section className="workbench-canvas">
            <header><Grid3X3 size={18} /><span>Garden.svg · синие грядки · красные боковые клетки</span></header>
            <GardenStage cleanliness={cleanliness} completeBiomes={completeBiomes} exposedSides={exposedSides} exposedCorners={exposedCorners} model={model} activeBiome={activeBiome} mode="debug" onToggle={toggleBed} />
          </section>
        </div>
      )}
      {variant === 'C' && (
        <div className="prototype-mask-layout">
          <header>
            <div><span className="prototype-eyebrow"><Bug size={15} /> Сравнение результата и маски</span><h1>Что именно сейчас раскрыто</h1></div>
            <button type="button" onClick={() => setCleanliness(new Map())}><RotateCcw size={17} /> Сбросить</button>
          </header>
          <div className="mask-pair">
            <figure><GardenStage cleanliness={cleanliness} completeBiomes={completeBiomes} exposedSides={exposedSides} exposedCorners={exposedCorners} model={model} activeBiome={activeBiome} mode="map" onToggle={toggleBed} /><figcaption>Композиция карты</figcaption></figure>
            <figure><GardenStage cleanliness={cleanliness} completeBiomes={completeBiomes} exposedSides={exposedSides} exposedCorners={exposedCorners} model={model} activeBiome={activeBiome} mode="mask" onToggle={toggleBed} /><figcaption>Маска: тёмное раскрыто</figcaption></figure>
          </div>
          <div className="mask-state-strip">
            <span><Check size={16} /> Активная клетка: {activeBedCleanliness}%</span>
            <span>{completeBiomes.size} чистых биомов</span>
            <span>{exposedSides.size} боковых клеток</span>
            <span>{exposedCorners.size} углов</span>
          </div>
        </div>
      )}
      <PrototypeSwitcher current={variant} onChange={changeVariant} />
    </main>
  )
}
