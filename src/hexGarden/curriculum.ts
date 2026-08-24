import { beds, type BedDefinition, type CharacterDefinition } from '../data/model'
import { isCardDue, type CardState } from '../learning'

type UnlockableSave = {
  unlockedBedIds: readonly string[]
  masteredBedIds: readonly string[]
}

/**
 * Learning progression is strictly Heisig/RTH bed order. Garden geography
 * never chooses the next character or the next study bed.
 */
export function nextLockedBed(unlockedBedIds: ReadonlySet<string>): BedDefinition | undefined {
  return beds.find((bed) => !unlockedBedIds.has(bed.id))
}

export function applySequentialUnlock(save: UnlockableSave): {
  unlockedBedIds: string[]
  masteredBedIds: string[]
  extraClears: number
} {
  const unlocked = new Set(save.unlockedBedIds)
  const mastered = new Set(save.masteredBedIds)
  let extraClears = 0
  while (true) {
    const next = nextLockedBed(unlocked)
    if (!next) break
    unlocked.add(next.id)
    if (next.characterIds.length > 0) break
    mastered.add(next.id)
    extraClears += 1
  }
  return {
    unlockedBedIds: [...unlocked],
    masteredBedIds: [...mastered],
    extraClears,
  }
}

/** Completing a bed grants one hex-clear plus sequential curriculum access. */
export function grantClearForMasteredBed(save: UnlockableSave): {
  unlockedBedIds: string[]
  masteredBedIds: string[]
  grantedClears: number
} {
  const unlocked = applySequentialUnlock(save)
  return {
    unlockedBedIds: unlocked.unlockedBedIds,
    masteredBedIds: unlocked.masteredBedIds,
    grantedClears: 1 + unlocked.extraClears,
  }
}

export function nextStudyBed(
  unlockedBedIds: readonly string[],
  cards: Readonly<Record<string, CardState>>,
): BedDefinition | undefined {
  const unlocked = new Set(unlockedBedIds)
  const due = beds.find((bed) => (
    unlocked.has(bed.id)
    && bed.characters.some((character) => isCardDue(cards[character.id]))
  ))
  if (due) return due
  return beds.find((bed) => unlocked.has(bed.id) && bed.characters.length > 0)
}

export function nextStudyCharacter(
  unlockedBedIds: readonly string[],
  cards: Readonly<Record<string, CardState>>,
): CharacterDefinition | undefined {
  const bed = nextStudyBed(unlockedBedIds, cards)
  return bed?.characters.find((character) => isCardDue(cards[character.id])) ?? bed?.characters[0]
}
