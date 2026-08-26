import { createEmptyCard, fsrs, Rating, type Card, type CardInput } from 'ts-fsrs'

export type CardState = Card

export type ReviewEvent = {
  id: string
  characterId: string
  timestamp: number
  rating: 'again' | 'good'
  totalMistakes: number
  hintUsed: boolean
  durationMs: number
  inputDevice: 'mouse' | 'touch' | 'pen'
}

const scheduler = fsrs({ enable_fuzz: true })

export function isCardDue(card?: CardState, now = new Date()): boolean {
  return !card || new Date(card.due).getTime() <= now.getTime()
}

/** A new character is traced once, then recalled before its first FSRS review. */
export function isInitialTrace(card: CardState | undefined, recallPending: boolean): boolean {
  return !card && !recallPending
}

export function reviewCard(card: CardState | undefined, mistakes: number, hintUsed: boolean, now = new Date()) {
  const rating = mistakes >= 3 || hintUsed ? Rating.Again : Rating.Good
  const result = scheduler.next((card ?? createEmptyCard()) as CardInput, now, rating)
  return {
    card: result.card,
    rating: rating === Rating.Again ? 'again' as const : 'good' as const,
  }
}
