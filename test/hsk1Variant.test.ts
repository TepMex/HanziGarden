import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import rawCharacters from '../src/data/rth.json'
import {
  HSK_1_2_0_CHARACTERS,
  HSK_2_2_0_SUPPLEMENT_CHARACTERS,
  HSK1_VARIANT_CHARACTERS,
} from '../src/data/hsk1Variant'

describe('Hanzi Garden HSK 1 character set', () => {
  test('fills 220 beds with unique HSK 1 and HSK 2.0 characters', () => {
    expect(HSK_1_2_0_CHARACTERS).toHaveLength(174)
    expect(HSK_2_2_0_SUPPLEMENT_CHARACTERS).toHaveLength(46)
    expect(HSK1_VARIANT_CHARACTERS).toHaveLength(220)
    expect(new Set(HSK1_VARIANT_CHARACTERS).size).toBe(220)
    expect(HSK1_VARIANT_CHARACTERS.slice(0, 174)).toEqual(HSK_1_2_0_CHARACTERS)
  })

  test('reuses complete production character and stroke data', () => {
    const sourceHanzi = new Set(rawCharacters.map((item) => item.hanzi))
    for (const hanzi of HSK1_VARIANT_CHARACTERS) {
      expect(sourceHanzi.has(hanzi)).toBe(true)
      expect(existsSync(new URL(`../public/hanzi/${hanzi}.json`, import.meta.url))).toBe(true)
    }
  })
})
