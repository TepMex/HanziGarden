import { readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'
import {
  openContentDocument,
  serializeContentDocument,
  updateAchievementFormula,
  updateCharacterStructure,
} from '../src/contentEditor/document'

const structureSource = JSON.stringify([
  { hanzi: '一', keyword: 'один, единица', primitive: null, components: [] },
  { hanzi: '古', keyword: 'древний', primitive: 'древность', components: [{ hanzi: '十', keyword: 'десять' }, { hanzi: '口', keyword: 'рот' }] },
])

const achievementSource = JSON.stringify({
  kind: 'hanzi-garden.achievements',
  version: 1,
  achievements: [
    {
      id: 'combo_5',
      category: 'combo',
      title: 'Твёрдая рука',
      description: 'Написать 5 иероглифов подряд без ошибок.',
      secret: false,
      progressType: 'max',
      target: 5,
      badge: { atlas: 'category', index: 1 },
      formula: { on: ['kanji.completed', 'player.migrated'], when: 'event.combo >= 5 || player.bestComboEver >= 5' },
    },
  ],
}, null, 2)

test('opens a character structure catalog and keeps every entry', () => {
  const document = openContentDocument('character_structure_ru.json', structureSource)
  expect(document.kind).toBe('character-structure')
  if (document.kind !== 'character-structure') return
  expect(document.fileName).toBe('character_structure_ru.json')
  expect(document.entries.map((entry) => entry.hanzi)).toEqual(['一', '古'])
})

test('rejects a file that is not a known game content document', () => {
  expect(() => openContentDocument('notes.txt', 'not json')).toThrow(/контент/)
  expect(() => openContentDocument('random.json', JSON.stringify({ hello: 'garden' }))).toThrow(/контент/)
})

test('updates keyword, primitive, and components of a selected hanzi', () => {
  const opened = openContentDocument('character_structure_ru.json', structureSource)
  if (opened.kind !== 'character-structure') throw new Error('expected structure catalog')
  const edited = updateCharacterStructure(opened, '古', {
    keyword: 'старый',
    primitive: 'старина',
    components: [{ hanzi: '十', keyword: 'десятка' }],
  })
  expect(edited.entries[0]).toEqual(opened.entries[0])
  expect(edited.entries[1]).toMatchObject({
    hanzi: '古',
    keyword: 'старый',
    primitive: 'старина',
    components: [{ hanzi: '十', keyword: 'десятка' }],
  })
})

test('serializes an edited catalog that can replace the original asset', () => {
  const opened = openContentDocument('character_structure_ru.json', structureSource)
  if (opened.kind !== 'character-structure') throw new Error('expected structure catalog')
  const saved = serializeContentDocument(updateCharacterStructure(opened, '一', { keyword: 'единица', primitive: null }))
  const reopened = openContentDocument('character_structure_ru.json', saved)
  if (reopened.kind !== 'character-structure') throw new Error('expected structure catalog')
  expect(reopened.entries[0]).toMatchObject({ hanzi: '一', keyword: 'единица', primitive: null, components: [] })
  expect(reopened.entries[1]).toEqual(opened.entries[1])
})

test('opens an achievement catalog and updates an award formula', () => {
  const opened = openContentDocument('achievements.json', achievementSource)
  expect(opened.kind).toBe('achievement-catalog')
  if (opened.kind !== 'achievement-catalog') return
  const edited = updateAchievementFormula(opened, 'combo_5', {
    on: ['kanji.completed'],
    when: 'event.combo >= 10',
  })
  expect(edited.achievements[0]?.formula).toEqual({ on: ['kanji.completed'], when: 'event.combo >= 10' })
  const saved = serializeContentDocument(edited)
  expect(saved).toContain('event.combo >= 10')
  expect(JSON.parse(saved).kind).toBe('hanzi-garden.achievements')
})

test('opens the bundled production assets the editor is meant to replace', () => {
  const structure = openContentDocument('character_structure_ru.json', readFileSync('src/data/character_structure_ru.json', 'utf8'))
  const achievements = openContentDocument('achievements.json', readFileSync('src/data/achievements.json', 'utf8'))
  expect(structure.kind).toBe('character-structure')
  expect(achievements.kind).toBe('achievement-catalog')
  if (structure.kind !== 'character-structure' || achievements.kind !== 'achievement-catalog') return
  expect(structure.entries).toHaveLength(2974)
  expect(achievements.achievements).toHaveLength(61)
})

test('rejects an achievement formula that cannot be parsed', () => {
  const opened = openContentDocument('achievements.json', achievementSource)
  if (opened.kind !== 'achievement-catalog') throw new Error('expected achievement catalog')
  expect(() => updateAchievementFormula(opened, 'combo_5', { on: ['kanji.completed'], when: 'event.combo >=' })).toThrow(/формул/)
})
