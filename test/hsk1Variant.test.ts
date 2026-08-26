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
