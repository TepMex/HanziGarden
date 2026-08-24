import {
  GARDEN_HEX_COUNT,
  GARDEN_HEX_IDS,
  GARDEN_HEXES,
  hexId,
  hexNeighbors,
  parseHexId,
  type AxialHex,
} from './hexGrid'

export type GardenHexStatus = 'hidden' | 'available' | 'cleared'

export type GardenProgress = Readonly<{
  clearedHexes: readonly string[]
  pendingClearActions: number
}>

export const CENTER_HEX_ID = '0,0'

export function createGardenSeed(randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function normalizeClearedHexes(ids: readonly string[]): string[] {
  const valid = new Set(ids.filter((id) => GARDEN_HEX_IDS.has(id)))
  valid.add(CENTER_HEX_ID)
  return GARDEN_HEXES.map(hexId).filter((id) => valid.has(id))
}

export function gardenHexStatus(
  coordinate: AxialHex,
  clearedHexes: ReadonlySet<string>,
): GardenHexStatus {
  const id = hexId(coordinate)
  if (clearedHexes.has(id)) return 'cleared'
  return hexNeighbors(coordinate).some((neighbor) => clearedHexes.has(hexId(neighbor)))
    ? 'available'
    : 'hidden'
}

export function gardenFrontier(clearedHexIds: readonly string[]): AxialHex[] {
  const cleared = new Set(normalizeClearedHexes(clearedHexIds))
  return GARDEN_HEXES.filter((coordinate) => gardenHexStatus(coordinate, cleared) === 'available')
}

export function canClearHex(progress: GardenProgress, id: string): boolean {
  if (progress.pendingClearActions <= 0) return false
  const coordinate = parseHexId(id)
  if (!coordinate) return false
  const cleared = new Set(normalizeClearedHexes(progress.clearedHexes))
  return gardenHexStatus(coordinate, cleared) === 'available'
}

export function clearGardenHex(progress: GardenProgress, id: string): GardenProgress {
  if (!canClearHex(progress, id)) return progress
  return {
    clearedHexes: normalizeClearedHexes([...progress.clearedHexes, id]),
    pendingClearActions: Math.max(0, progress.pendingClearActions - 1),
  }
}

export function grantClearAction(progress: GardenProgress): GardenProgress {
  const clearedCount = normalizeClearedHexes(progress.clearedHexes).length
  const maximumPending = Math.max(0, GARDEN_HEX_COUNT - clearedCount)
  return {
    clearedHexes: normalizeClearedHexes(progress.clearedHexes),
    pendingClearActions: Math.min(maximumPending, progress.pendingClearActions + 1),
  }
}
