import { characters, type CharacterDefinition } from './data/model'
import { isCardDue, type CardState } from './learning'

/**
 * Geography is deliberately absent from this interface. The first due item in
 * canonical Heisig frame order wins; an unseen character is due by definition.
 */
export function nextCurriculumCharacter(
  cards: Readonly<Record<string, CardState>>,
  now = new Date(),
): CharacterDefinition | null {
  return characters.find((character) => isCardDue(cards[character.id], now)) ?? null
}

export function nextNewCurriculumCharacter(
  cards: Readonly<Record<string, CardState>>,
): CharacterDefinition | null {
  return characters.find((character) => cards[character.id] === undefined) ?? null
}
