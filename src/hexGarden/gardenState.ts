import { gardenHexes, hasHex, hexId, neighborIds, ORIGIN, parseHexId, type Axial } from './hexGrid'

export type HexVisibility = 'hidden' | 'available' | 'cleared'

export type GardenProgress = {
  gardenSeed: string
  gardenGenerationVersion: number
  clearedHexes: string[]
  pendingClearActions: number
}

export const CENTER_HEX_ID = hexId(ORIGIN)

export function clearedHexSet(clearedHexes: readonly string[]): Set<string> {
  return new Set(clearedHexes)
}

export function hexVisibility(
  clearedHexes: ReadonlySet<string>,
  hex: Axial,
): HexVisibility {
  const id = hexId(hex)
  if (clearedHexes.has(id)) return 'cleared'
  if (neighborIds(id).some((neighbor) => clearedHexes.has(neighbor))) return 'available'
  return 'hidden'
}

export function availableHexIds(clearedHexes: ReadonlySet<string>): string[] {
  const available = new Set<string>()
  for (const hex of gardenHexes()) {
    if (hexVisibility(clearedHexes, hex) === 'available') available.add(hexId(hex))
  }
  return [...available].sort()
}

export function canClearHex(
  clearedHexes: ReadonlySet<string>,
  pendingClearActions: number,
  hex: Axial,
): boolean {
  return pendingClearActions > 0 && hasHex(hex) && hexVisibility(clearedHexes, hex) === 'available'
}

export function clearHex(
  progress: Pick<GardenProgress, 'clearedHexes' | 'pendingClearActions'>,
  hex: Axial,
): Pick<GardenProgress, 'clearedHexes' | 'pendingClearActions'> | null {
  const cleared = clearedHexSet(progress.clearedHexes)
  if (!canClearHex(cleared, progress.pendingClearActions, hex)) return null
  return {
    clearedHexes: [...progress.clearedHexes, hexId(hex)],
    pendingClearActions: progress.pendingClearActions - 1,
  }
}

export function revealEntireGarden(): string[] {
  return gardenHexes().map(hexId)
}

export function isValidClearedHexId(id: string): boolean {
  try {
    return hasHex(parseHexId(id))
  } catch {
    return false
  }
}
