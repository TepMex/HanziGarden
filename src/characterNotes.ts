export const CHARACTER_NOTE_MAX_LENGTH = 500

export function characterNoteFor(
  notes: Readonly<Record<string, string>> | undefined,
  characterId: string,
): string {
  return notes?.[characterId] ?? ''
}

export function normalizeCharacterNote(text: string): string {
  return text.replace(/\r\n/g, '\n').trim().slice(0, CHARACTER_NOTE_MAX_LENGTH)
}

export function withCharacterNote(
  notes: Readonly<Record<string, string>>,
  characterId: string,
  text: string,
): Record<string, string> {
  const next = { ...notes }
  const normalized = normalizeCharacterNote(text)
  if (normalized) next[characterId] = normalized
  else delete next[characterId]
  return next
}

export function viewingCharacterNoteCostsXp(existingNote: string): boolean {
  return normalizeCharacterNote(existingNote).length > 0
}
