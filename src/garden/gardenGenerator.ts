import {
  BIOME_REGISTRY,
  type BiomeDefinition,
  type PlantDefinition,
  type PlantRarity,
} from './biomeRegistry'
import {
  GARDEN_HEXES,
  hexDistance,
  hexId,
  type AxialHex,
} from './hexGrid'

export const CURRENT_GARDEN_GENERATION_VERSION = 1 as const
export type GardenGenerationVersion = typeof CURRENT_GARDEN_GENERATION_VERSION

export type GardenCellContent = Readonly<{
  coordinate: AxialHex
  biome: BiomeDefinition
  rarity: PlantRarity
  plant: PlantDefinition
}>

type BiomeNucleus = Readonly<{
  coordinate: AxialHex
  biome: BiomeDefinition
  bias: number
}>

const UINT32_RANGE = 0x1_0000_0000
const BIOME_NUCLEUS_COUNT = 24

/** Stable FNV-1a over length-prefixed UTF-16 strings; independent of platform locale. */
export function stableHash32(...parts: readonly (string | number)[]): number {
  let hash = 0x811c9dc5
  for (const rawPart of parts) {
    const part = String(rawPart)
    const token = `${part.length}:${part};`
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  return hash >>> 0
}

export function deterministicRandom(
  seed: string,
  coordinate: AxialHex,
  stream: string,
): number {
  return stableHash32(seed, coordinate.q, coordinate.r, stream) / UINT32_RANGE
}

function axialEuclideanDistance(left: AxialHex, right: AxialHex): number {
  const q = left.q - right.q
  const r = left.r - right.r
  return Math.sqrt(q * q + q * r + r * r)
}

function biomeNucleiV1(seed: string): BiomeNucleus[] {
  const rankedCoordinates = [...GARDEN_HEXES].sort((left, right) => {
    const difference = stableHash32(seed, left.q, left.r, 'biome:nucleus-position')
      - stableHash32(seed, right.q, right.r, 'biome:nucleus-position')
    return difference || hexId(left).localeCompare(hexId(right))
  })

  const selected: AxialHex[] = []
  for (const coordinate of rankedCoordinates) {
    if (selected.every((other) => hexDistance(coordinate, other) >= 2)) selected.push(coordinate)
    if (selected.length === BIOME_NUCLEUS_COUNT) break
  }
  for (const coordinate of rankedCoordinates) {
    if (selected.length === BIOME_NUCLEUS_COUNT) break
    if (!selected.some((other) => hexId(other) === hexId(coordinate))) selected.push(coordinate)
  }

  const palette = [...BIOME_REGISTRY].sort((left, right) => {
    const difference = stableHash32(seed, left.id, 'biome:palette-order')
      - stableHash32(seed, right.id, 'biome:palette-order')
    return difference || left.id.localeCompare(right.id)
  })

  return selected.map((coordinate, index) => {
    const biome = index < palette.length
      ? palette[index]!
      : BIOME_REGISTRY[stableHash32(seed, index, 'biome:extra-nucleus') % BIOME_REGISTRY.length]!
    return {
      coordinate,
      biome,
      bias: (stableHash32(seed, index, 'biome:nucleus-bias') / UINT32_RANGE - 0.5) * 0.36,
    }
  })
}

const nucleusCache = new Map<string, readonly BiomeNucleus[]>()

function nucleiFor(seed: string, version: GardenGenerationVersion): readonly BiomeNucleus[] {
  const cacheKey = `${version}:${seed}`
  const cached = nucleusCache.get(cacheKey)
  if (cached) return cached
  const nuclei = biomeNucleiV1(seed)
  nucleusCache.set(cacheKey, nuclei)
  return nuclei
}

function biomeForCellV1(seed: string, coordinate: AxialHex): BiomeDefinition {
  const nuclei = nucleiFor(seed, 1)
  let winner = nuclei[0]!
  let winnerDistance = Number.POSITIVE_INFINITY
  for (const nucleus of nuclei) {
    const distance = axialEuclideanDistance(coordinate, nucleus.coordinate) + nucleus.bias
    if (
      distance < winnerDistance
      || (distance === winnerDistance && nucleus.biome.id < winner.biome.id)
    ) {
      winner = nucleus
      winnerDistance = distance
    }
  }
  return winner.biome
}

export function plantRarityForRoll(roll: number): PlantRarity {
  if (roll < 0.85) return 'common'
  if (roll < 0.95) return 'rare'
  return 'veryRare'
}

function generateGardenCellV1(seed: string, coordinate: AxialHex): GardenCellContent {
  const biome = biomeForCellV1(seed, coordinate)
  // This stream is intentionally unrelated to every "biome:*" stream above.
  const rarity = plantRarityForRoll(deterministicRandom(seed, coordinate, 'plant:rarity'))
  return {
    coordinate,
    biome,
    rarity,
    plant: biome.plants[rarity],
  }
}

export function generateGardenCell(
  seed: string,
  coordinate: AxialHex,
  version: GardenGenerationVersion = CURRENT_GARDEN_GENERATION_VERSION,
): GardenCellContent {
  if (version === 1) return generateGardenCellV1(seed, coordinate)
  throw new Error(`Unsupported garden generation version: ${String(version)}`)
}

export function generateGarden(
  seed: string,
  version: GardenGenerationVersion = CURRENT_GARDEN_GENERATION_VERSION,
): GardenCellContent[] {
  return GARDEN_HEXES.map((coordinate) => generateGardenCell(seed, coordinate, version))
}
