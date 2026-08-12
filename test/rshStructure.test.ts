import { describe, expect, test } from 'bun:test'
import { characters } from '../src/data/model'
import { requireCharacterStructure, structureByHanzi } from '../src/data/rshStructure'

describe('RSH character structure data', () => {
  test('indexes every structure exactly once', () => {
    expect(structureByHanzi).toHaveLength(3019)
    expect(new Set(structureByHanzi.keys()).size).toBe(structureByHanzi.size)
  })

  test('covers every study character and enriches its definition', () => {
    expect(characters).toHaveLength(2974)
    characters.forEach((character) => {
      expect(character.structure).toBe(requireCharacterStructure(character.hanzi))
    })
  })

  test('keeps primitive and direct component data intact', () => {
    expect(requireCharacterStructure('一')).toMatchObject({ primitive: 'пол', components: [] })
    expect(requireCharacterStructure('二')).toMatchObject({
      primitive: null,
      components: [{ hanzi: '一', keyword: 'один' }],
    })
  })
})
