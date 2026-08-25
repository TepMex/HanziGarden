import { describe, expect, test } from 'bun:test'
import {
  CHARACTER_NOTE_MAX_LENGTH,
  characterNoteFor,
  viewingCharacterNoteCostsXp,
  withCharacterNote,
} from '../src/characterNotes'

describe('character notes', () => {
  test('stores a trimmed player note and leaves other characters untouched', () => {
    const notes = withCharacterNote({ 'rsh-0001': 'keep' }, 'rsh-0002', '  вода слева  ')
    expect(notes).toEqual({
      'rsh-0001': 'keep',
      'rsh-0002': 'вода слева',
    })
    expect(characterNoteFor(notes, 'rsh-0002')).toBe('вода слева')
  })

  test('clears an empty note so later opening is writing rather than viewing', () => {
    const notes = withCharacterNote({ 'rsh-0001': 'old' }, 'rsh-0001', '   ')
    expect(notes).toEqual({})
    expect(characterNoteFor(notes, 'rsh-0001')).toBe('')
  })

  test('caps a note at the published maximum length', () => {
    const notes = withCharacterNote({}, 'rsh-0001', 'ж'.repeat(CHARACTER_NOTE_MAX_LENGTH + 8))
    expect(characterNoteFor(notes, 'rsh-0001')).toBe('ж'.repeat(CHARACTER_NOTE_MAX_LENGTH))
  })

  test('charges XP only when a saved note already exists', () => {
    expect(viewingCharacterNoteCostsXp('')).toBe(false)
    expect(viewingCharacterNoteCostsXp('   ')).toBe(false)
    expect(viewingCharacterNoteCostsXp('огонь сверху')).toBe(true)
  })
})
