import { beds } from '../data/model'
import { biomes, GARDEN_HEIGHT, GARDEN_WIDTH, type BiomeCulture } from '../data/mapLayout'
import type { SaveGame } from '../db'
import { bedDueFraction, weedCoverageFromDueFraction } from '../garden'
import { organicWeedMask } from './weedMask'
import { artRandom, hexGardenArt, spriteForBed } from './hexGardenArt'
import { gardenHexes, hexCorners, HEX_SIZE, HEX_Y_SCALE, hexNeighbors, type GardenHex } from './hexGardenLayout'

type Sprites = ReadonlyMap<string, CanvasImageSource & { width: number; height: number }>
const ART_SCALE = HEX_SIZE / 126

function layer(width = GARDEN_WIDTH, height = GARDEN_HEIGHT): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function traceHex(context: CanvasRenderingContext2D, hex: GardenHex, scale = 1): void {
  context.beginPath()
  hexCorners(hex, scale).forEach((point, index) => context[index ? 'lineTo' : 'moveTo'](point.x, point.y))
  context.closePath()
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fillStyle = color
  g.fill()
}

function line(g: CanvasRenderingContext2D, x: number, y: number, x1: number, y1: number, color: string, width = 1): void {
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(x1, y1)
  g.strokeStyle = color
  g.lineWidth = width
  g.lineCap = 'round'
  g.stroke()
}

function cultureFor(hex: GardenHex): BiomeCulture { return biomes[hex.biomeIndex]!.culture }

function buildTerrain(): HTMLCanvasElement {
  const terrain = layer()
  const g = terrain.getContext('2d')!
  // Soft overlapping ground colors, connected ponds and a single island mask,
  // following the supplied Site's terrain pass.
  g.fillStyle = '#91ac69'
  g.fillRect(0, 0, GARDEN_WIDTH, GARDEN_HEIGHT)
  for (const hex of gardenHexes) {
    const glow = g.createRadialGradient(hex.x, hex.y, 0, hex.x, hex.y, HEX_SIZE * 2.2)
    glow.addColorStop(0, hexGardenArt[cultureFor(hex)].ground)
    glow.addColorStop(1, 'transparent')
    g.fillStyle = glow
    g.fillRect(hex.x - HEX_SIZE * 2.2, hex.y - HEX_SIZE * 2.2, HEX_SIZE * 4.4, HEX_SIZE * 4.4)
  }
  for (let index = 0; index < 18000; index += 1) {
    ellipse(g, artRandom(91273, index) * GARDEN_WIDTH, artRandom(1931, index) * GARDEN_HEIGHT,
      0.5 + artRandom(93, index) * 2.4, 0.3 + artRandom(94, index), ['#d4d69488', '#517d5266', '#e4db9766', '#2e735c55'][index % 4]!)
  }
  for (const hex of gardenHexes.filter((cell) => cultureFor(cell) === 'lotus')) {
    traceHex(g, hex, 1.008)
    g.fillStyle = '#55b7a7'
    g.fill()
    for (let index = 0; index < 12; index += 1) {
      g.beginPath()
      g.ellipse(hex.x + (artRandom(hex.bedIndex, index) - 0.5) * 60, hex.y + (artRandom(hex.bedIndex, index + 20) - 0.5) * 40, 4 + artRandom(41, index) * 10, 1, 0, 0.1, 2.5)
      g.strokeStyle = '#c6f5d86b'
      g.lineWidth = 0.8
      g.stroke()
    }
  }
  const mask = layer()
  const mg = mask.getContext('2d')!
  mg.fillStyle = '#fff'
  gardenHexes.forEach((hex) => { traceHex(mg, hex, 1.006); mg.fill() })
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(mask, 0, 0)
  return terrain
}

/** The seven crops absent from the Site's 8-biome catalog keep distinct silhouettes. */
function drawCrop(g: CanvasRenderingContext2D, culture: BiomeCulture, seed: number): void {
  const art = hexGardenArt[culture]
  if (culture === 'rice' || culture === 'wheat' || culture === 'rapeseed') {
    for (let i = 0; i < 18; i += 1) {
      const x = (artRandom(seed, i) - 0.5) * 145
      const y = artRandom(seed, i + 30) * 20
      const height = 55 + artRandom(seed, i + 60) * 60
      line(g, x, y, x + 8, y - height, '#638443', 2.4)
      line(g, x, y - 8, x - 19, y - height * 0.5, '#71954d', 3)
      for (let j = 0; j < 6; j += 1) {
        const cy = y - height + j * 5
        ellipse(g, x + 8 + (j % 2 ? 5 : -5), cy, culture === 'rapeseed' ? 5 : 3, 4, art.accent)
      }
    }
    return
  }
  for (let i = 0; i < 28; i += 1) {
    const x = (artRandom(seed, i) - 0.5) * 150
    const y = -artRandom(seed, i + 40) * 55
    ellipse(g, x, y, 16, 10, i % 3 ? '#598247' : '#86a65e')
    line(g, x - 7, y + 4, x + 6, y - 5, '#b3c77b', 1)
    if (culture === 'tea') continue
    const cy = y - 15 - artRandom(seed, i + 70) * 28
    line(g, x, y, x + 3, cy, '#628450', 2)
    if (culture === 'berries') {
      for (let j = 0; j < 4; j += 1) ellipse(g, x + (j % 2) * 7, cy + Math.floor(j / 2) * 7, 4, 4, j % 2 ? '#b16c98' : '#75416a')
    } else {
      for (let petal = 0; petal < (culture === 'orchid' ? 5 : 10); petal += 1) {
        const angle = petal * Math.PI * 2 / (culture === 'orchid' ? 5 : 10)
        ellipse(g, x + Math.cos(angle) * 7, cy + Math.sin(angle) * 6, 5, 3, art.accent)
      }
      ellipse(g, x, cy, 3, 3, '#f6e6a2')
    }
  }
}

type Border = { a: { x: number; y: number }; b: { x: number; y: number }; hex: GardenHex; neighbor?: GardenHex; depth: number }
function buildBorders(): Border[] {
  return gardenHexes.flatMap((hex) => {
    const corners = hexCorners(hex)
    const neighbors = hexNeighbors(hex)
    return corners.flatMap((a, side) => {
      const b = corners[(side + 1) % 6]!
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const neighbor = neighbors.find((candidate) => Math.hypot((candidate.x + hex.x) / 2 - mid.x, (candidate.y + hex.y) / 2 - mid.y) < 0.01)
      if (neighbor && (neighbor.biomeId === hex.biomeId || neighbor.bedIndex < hex.bedIndex)) return []
      // Segment fences so crowns and rails interleave naturally in depth order.
      return Array.from({ length: 4 }, (_, index) => {
        const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
        const start = at(index / 4), end = at((index + 1) / 4)
        return { a: start, b: end, hex, neighbor, depth: (start.y + end.y) / 2 }
      })
    })
  })
}

function drawBorder(g: CanvasRenderingContext2D, border: Border, healthy: boolean): void {
  const { a, b, hex, neighbor } = border
  const cultures = [cultureFor(hex), ...(neighbor ? [cultureFor(neighbor)] : [])]
  g.save()
  g.globalAlpha = healthy ? 1 : 0.5
  if (cultures.includes('lotus')) {
    line(g, a.x, a.y, b.x, b.y, '#536f48', 5.4)
    line(g, a.x, a.y, b.x, b.y, '#c2b887', 3.6)
    line(g, a.x, a.y - 0.7, b.x, b.y - 0.7, '#e1d4a3', 1.7)
  } else {
    const stone = cultures.includes('pine')
    const bamboo = cultures.includes('bamboo')
    const height = stone ? 7 : 10
    const dark = stone ? '#758673' : bamboo ? '#65754a' : '#81603f'
    const light = stone ? '#d6d6b4' : bamboo ? '#c6c68b' : '#c9a875'
    line(g, a.x + 1, a.y + 2, b.x + 1, b.y + 2, '#324e3540', 4)
    for (const offset of stone ? [3, 6] : [3, 8]) {
      line(g, a.x, a.y - offset, b.x, b.y - offset, dark, stone ? 5 : 2.5)
      line(g, a.x, a.y - offset - 1, b.x, b.y - offset - 1, light, 0.9)
    }
    for (const point of [a, b]) {
      line(g, point.x, point.y, point.x, point.y - height, dark, 3)
      line(g, point.x - 0.6, point.y - 1, point.x - 0.6, point.y - height, light, 1)
    }
  }
  g.restore()
}

let terrain: HTMLCanvasElement | null = null
const borders = buildBorders()
const cropImages = new Map<string, HTMLCanvasElement>()
type PlantImage = { clean: HTMLCanvasElement; dirty: HTMLCanvasElement; anchorX: number; anchorY: number }
const plantImages = new Map<string, PlantImage>()

function cropImage(culture: BiomeCulture, seed: number): HTMLCanvasElement {
  const key = `${culture}:${seed}`
  let image = cropImages.get(key)
  if (!image) {
    image = layer(220, 180)
    const context = image.getContext('2d')!
    context.translate(110, 155)
    drawCrop(context, culture, seed)
    cropImages.set(key, image)
  }
  return image
}

/** Tint small sprites once, rather than applying a filter to the whole map per plant. */
function plantImage(culture: BiomeCulture, seed: number, sprites: Sprites): PlantImage {
  const sprite = spriteForBed(culture, seed)
  const key = sprite ?? `${culture}:${seed}`
  let result = plantImages.get(key)
  if (!result) {
    const source = sprite ? sprites.get(sprite)! : cropImage(culture, seed)
    const width = (sprite ? hexGardenArt[culture].size : 220) * ART_SCALE
    const height = width * source.height / source.width
    const clean = layer(Math.ceil(width), Math.ceil(height))
    clean.getContext('2d')!.drawImage(source, 0, 0, clean.width, clean.height)
    const dirty = layer(clean.width, clean.height)
    const context = dirty.getContext('2d')!
    context.filter = 'saturate(.2) brightness(.43)'
    context.drawImage(clean, 0, 0)
    result = { clean, dirty, anchorX: clean.width / 2, anchorY: sprite ? clean.height : 155 * ART_SCALE }
    plantImages.set(key, result)
  }
  return result
}

export function drawHexGarden(g: CanvasRenderingContext2D, save: SaveGame, sprites: Sprites): void {
  terrain ??= buildTerrain()
  g.clearRect(0, 0, GARDEN_WIDTH, GARDEN_HEIGHT)
  const coverages = new Map(beds.map((bed) => [bed.id, save.unlockedBedIds.includes(bed.id) ? weedCoverageFromDueFraction(bedDueFraction(bed, save.cards)) : 1]))
  const cleanBiomes = new Set(biomes.filter((biome) => beds.filter((bed) => bed.biomeId === biome.id).every((bed) => coverages.get(bed.id) === 0)).map((biome) => biome.id))
  g.save()
  g.shadowColor = '#29473a77'
  g.shadowBlur = 24
  g.shadowOffsetY = 20
  g.drawImage(terrain, 0, 0)
  g.restore()
  // A global dirt mask keeps adjacent overgrown ground seamless. FSRS still
  // controls the exact coverage, including the existing partial-bed formula.
  const dirty = layer(), dg = dirty.getContext('2d')!
  dg.filter = 'saturate(.25) brightness(.48)'
  dg.drawImage(terrain, 0, 0)
  dg.filter = 'none'
  const mask = layer(), mg = mask.getContext('2d')!
  mg.fillStyle = '#fff'
  for (const hex of gardenHexes) {
    const coverage = coverages.get(hex.id)!
    if (!coverage) continue
    if (coverage === 1) { traceHex(mg, hex, 1.008); mg.fill(); continue }
    const width = Math.ceil(Math.sqrt(3) * HEX_SIZE), height = Math.ceil(2 * HEX_SIZE * HEX_Y_SCALE)
    const eligible = new Uint8Array(width * height)
    for (let i = 0; i < eligible.length; i += 1) {
      const x = Math.abs(i % width + 0.5 - width / 2)
      const y = Math.abs(Math.floor(i / width) + 0.5 - height / 2) / HEX_Y_SCALE
      eligible[i] = x <= Math.sqrt(3) * HEX_SIZE / 2 && y <= HEX_SIZE && x + Math.sqrt(3) * y <= Math.sqrt(3) * HEX_SIZE ? 1 : 0
    }
    const pixels = organicWeedMask(beds[hex.bedIndex]!.seed, coverage, width, height, eligible)
    const patch = layer(width, height), pg = patch.getContext('2d')!, image = pg.createImageData(width, height)
    pixels.forEach((alpha, index) => { image.data[index * 4 + 3] = alpha })
    pg.putImageData(image, 0, 0)
    mg.save(); traceHex(mg, hex, 1.004); mg.clip()
    mg.drawImage(patch, hex.x - width / 2, hex.y - height / 2)
    mg.restore()
  }
  dg.globalCompositeOperation = 'destination-in'
  dg.drawImage(mask, 0, 0)
  g.drawImage(dirty, 0, 0)

  const objects = [
    ...gardenHexes.map((hex) => ({ depth: hex.y + 25 * ART_SCALE, hex, border: null as Border | null })),
    ...borders.map((border) => ({ depth: border.depth, hex: null as GardenHex | null, border })),
  ].sort((a, b) => a.depth - b.depth)
  for (const object of objects) {
    if (object.border) {
      const edge = object.border
      drawBorder(g, edge, edge.neighbor ? coverages.get(edge.hex.id) === 0 && coverages.get(edge.neighbor.id) === 0 : cleanBiomes.has(edge.hex.biomeId))
      continue
    }
    const hex = object.hex!, culture = cultureFor(hex), bed = beds[hex.bedIndex]!, coverage = coverages.get(hex.id)!
    const scale = 0.94 + artRandom(bed.seed, 1) * 0.12
    const plant = plantImage(culture, bed.seed, sprites)
    g.save()
    ellipse(g, hex.x, hex.y + 25 * ART_SCALE, 65 * ART_SCALE, 18 * ART_SCALE, '#25482e44')
    // Entire crowns render above all ground, without clipping against any hex.
    const baseY = hex.y + (culture === 'lotus' ? 65 : 45) * ART_SCALE
    const x = hex.x - plant.anchorX * scale, y = baseY - plant.anchorY * scale
    const width = plant.clean.width * scale, height = plant.clean.height * scale
    if (coverage < 1) g.drawImage(plant.clean, x, y, width, height)
    if (coverage > 0) { g.globalAlpha = coverage; g.drawImage(plant.dirty, x, y, width, height) }
    g.restore()
    if (!coverage) continue
    // Locked beds are visibly overgrown, never replaced by discovery fog.
    for (let index = 0; index < 42; index += 1) {
      if (artRandom(bed.seed, index + 100) > coverage) continue
      const x = hex.x + (artRandom(bed.seed, index + 200) - 0.5) * HEX_SIZE * 1.2
      const y = hex.y + (artRandom(bed.seed, index + 300) - 0.5) * HEX_SIZE * 0.85
      const height = 7 + artRandom(bed.seed, index + 400) * 14
      for (const direction of [-1, 0, 1]) line(g, x, y, x + direction * 5, y - height + Math.abs(direction) * 4, index % 3 ? '#344b39' : '#6c7851', 1.8)
    }
  }
}
