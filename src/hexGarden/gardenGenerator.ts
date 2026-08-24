import { HEX_BIOME_IDS, plantForRarity, type PlantRarity } from './biomeRegistry'
import { cubeDistance, gardenHexes, HEX_RADIUS, type Axial } from './hexGrid'
import { hashStream, mulberry32, unitRandom } from './rng'

export const GARDEN_GENERATION_VERSION = 1
export const NUCLEUS_COUNT = 18
export const COMMON_WEIGHT = 0.85
export const RARE_WEIGHT = 0.10
export const VERY_RARE_WEIGHT = 0.05

export type HexContent = {
  biomeId: string
  plantId: string
  rarity: PlantRarity
}

type Nucleus = Axial & { biomeId: string }

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]!
    next[index] = next[swap]!
    next[swap] = current
  }
  return next
}

function nucleiForSeed(seed: string): Nucleus[] {
  const random = mulberry32(hashStream(seed, 0, 0, 'nuclei'))
  const candidates = shuffle(gardenHexes(), random)
  const nuclei: Nucleus[] = []
  const minSpacing = 2
  for (const hex of candidates) {
    if (nuclei.some((nucleus) => cubeDistance(hex, nucleus) < minSpacing)) continue
    nuclei.push({
      q: hex.q,
      r: hex.r,
      biomeId: HEX_BIOME_IDS[Math.floor(random() * HEX_BIOME_IDS.length)]!,
    })
    if (nuclei.length >= NUCLEUS_COUNT) break
  }
  if (nuclei.length === 0) {
    nuclei.push({ q: 0, r: 0, biomeId: HEX_BIOME_IDS[0]! })
  }
  return nuclei
}

const nucleiCache = new Map<string, Nucleus[]>()

function nuclei(seed: string): Nucleus[] {
  const cached = nucleiCache.get(seed)
  if (cached) return cached
  const generated = nucleiForSeed(seed)
  nucleiCache.set(seed, generated)
  return generated
}

export function biomeIdAt(seed: string, hex: Axial, generationVersion = GARDEN_GENERATION_VERSION): string {
  if (generationVersion !== 1) throw new Error(`Unsupported gardenGenerationVersion ${generationVersion}`)
  const sites = nuclei(seed)
  let nearest = sites[0]!
  let best = cubeDistance(hex, nearest)
  for (const site of sites.slice(1)) {
    const distance = cubeDistance(hex, site)
    const closer = distance < best
      || (distance === best && (site.q < nearest.q || (site.q === nearest.q && site.r < nearest.r)))
    if (!closer) continue
    nearest = site
    best = distance
  }
  return nearest.biomeId
}

export function plantRarityAt(seed: string, hex: Axial, generationVersion = GARDEN_GENERATION_VERSION): PlantRarity {
  if (generationVersion !== 1) throw new Error(`Unsupported gardenGenerationVersion ${generationVersion}`)
  const roll = unitRandom(seed, hex.q, hex.r, 'plant')
  if (roll < COMMON_WEIGHT) return 'common'
  if (roll < COMMON_WEIGHT + RARE_WEIGHT) return 'rare'
  return 'veryRare'
}

export function hexContent(
  seed: string,
  hex: Axial,
  generationVersion = GARDEN_GENERATION_VERSION,
): HexContent {
  const biomeId = biomeIdAt(seed, hex, generationVersion)
  const rarity = plantRarityAt(seed, hex, generationVersion)
  return {
    biomeId,
    rarity,
    plantId: plantForRarity(biomeId, rarity).id,
  }
}

export function hexContentById(
  seed: string,
  id: string,
  generationVersion = GARDEN_GENERATION_VERSION,
): HexContent {
  const [q, r] = id.split(',').map(Number)
  return hexContent(seed, { q: q!, r: r! }, generationVersion)
}

export function assertGardenRadius(): void {
  if (gardenHexes().length !== 1 + 3 * HEX_RADIUS * (HEX_RADIUS + 1)) {
    throw new Error('Hex garden radius does not produce 217 cells')
  }
}
