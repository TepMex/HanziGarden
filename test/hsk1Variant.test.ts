import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import rawCharacters from '../src/data/rth.json'
import { HSK1_MEANINGS, requireHsk1Meaning, withHsk1Meanings } from '../src/data/hsk1Meanings'
import {
  HSK_1_2_0_CHARACTERS,
  HSK_2_2_0_SUPPLEMENT_CHARACTERS,
  HSK1_VARIANT_CHARACTERS,
} from '../src/data/hsk1Variant'
import { requireCharacterStructure } from '../src/data/characterStructure'

describe('Hanzi Garden HSK 1 character set', () => {
  test('fills 220 beds with unique HSK 1 and HSK 2.0 characters', () => {
    expect(HSK_1_2_0_CHARACTERS).toHaveLength(174)
    expect(HSK_2_2_0_SUPPLEMENT_CHARACTERS).toHaveLength(46)
    expect(HSK1_VARIANT_CHARACTERS).toHaveLength(220)
    expect(new Set(HSK1_VARIANT_CHARACTERS).size).toBe(220)
    expect(new Set(HSK1_VARIANT_CHARACTERS)).toEqual(
      new Set([...HSK_1_2_0_CHARACTERS, ...HSK_2_2_0_SUPPLEMENT_CHARACTERS]),
    )
  })

  test('assigns HSK characters to beds in ascending RSH frame order', () => {
    const frameByHanzi = new Map(rawCharacters.map((item) => [item.hanzi, item.frame]))
    const framesOf = (hanzi: readonly string[]) =>
      hanzi.map((character) => {
        const frame = frameByHanzi.get(character)
        if (frame === undefined) throw new Error(`Missing RSH frame for ${character}`)
        return frame
      })
    const assertAscending = (hanzi: readonly string[]) => {
      const frames = framesOf(hanzi)
      expect(frames).toEqual([...frames].sort((left, right) => left - right))
    }
    assertAscending(HSK1_VARIANT_CHARACTERS)
    assertAscending(HSK_1_2_0_CHARACTERS)
    assertAscending(HSK_2_2_0_SUPPLEMENT_CHARACTERS)
  })

  test('reuses complete production character and stroke data', () => {
    const sourceHanzi = new Set(rawCharacters.map((item) => item.hanzi))
    for (const hanzi of HSK1_VARIANT_CHARACTERS) {
      expect(sourceHanzi.has(hanzi)).toBe(true)
      expect(existsSync(new URL(`../public/hanzi/${hanzi}.json`, import.meta.url))).toBe(true)
    }
  })
})

describe('Hanzi Garden HSK 1 meanings', () => {
  test('covers every selected Hanzi exactly once', () => {
    expect(Object.keys(HSK1_MEANINGS)).toHaveLength(220)
    expect(new Set(Object.keys(HSK1_MEANINGS))).toEqual(new Set(HSK1_VARIANT_CHARACTERS))
  })

  test('uses the HSK Russian keyword and additional meaning', () => {
    expect(requireHsk1Meaning('一')).toEqual({ keyword: 'один', primitive: null })
    expect(requireHsk1Meaning('月')).toEqual({ keyword: 'месяц', primitive: 'луна' })
    expect(requireHsk1Meaning('白')).toEqual({ keyword: 'белый', primitive: 'ясный; напрасно' })
    expect(requireHsk1Meaning('的')).toEqual({
      keyword: 'притяжательная частица',
      primitive: 'моё, твоё, его + чье',
    })
    expect(requireHsk1Meaning('个')).toEqual({ keyword: 'универсальное счётное слово', primitive: null })
    expect(requireHsk1Meaning('了')).toEqual({
      keyword: 'частица завершённости',
      primitive: 'частица изменения состояния',
    })
    expect(requireHsk1Meaning('哪')).toEqual({
      keyword: 'какой?; который?',
      primitive: 'где? (с 儿/里)',
    })
    expect(requireHsk1Meaning('喂')).toEqual({ keyword: 'алло!; эй!', primitive: 'кормить' })
  })

  test('overlays keyword and additional meaning without mutating the primary catalog', () => {
    const original = requireCharacterStructure('一')
    expect(original).toMatchObject({ keyword: 'один', primitive: null })

    const overlaid = withHsk1Meanings(original)
    expect(overlaid).toMatchObject({ hanzi: '一', keyword: 'один', primitive: null, components: [] })
    expect(original.keyword).toBe('один')
    expect(requireCharacterStructure('一').keyword).toBe('один')
  })

  test('replaces HSK component keywords and leaves other components unchanged', () => {
    const original = requireCharacterStructure('四')
    expect(original.components).toEqual([
      { hanzi: '囗', keyword: 'ограда' },
      { hanzi: '儿', keyword: 'ребёнок' },
    ])

    expect(withHsk1Meanings(original).components).toEqual([
      { hanzi: '囗', keyword: 'ограда' },
      { hanzi: '儿', keyword: 'ребёнок; сын' },
    ])
    expect(original.components[1]).toEqual({ hanzi: '儿', keyword: 'ребёнок' })
  })
})
