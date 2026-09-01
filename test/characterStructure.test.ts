import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import rawGraphics from '../data/component-graphics.json'
import keywordFallbacks from '../data/keyword-fallbacks.json'
import { characters } from '../src/data/model'
import {
  requireCharacterStructure,
  structureByHanzi,
} from '../src/data/characterStructure'

const MISSING_GREEDY = [
  '吾', '哇', '尧', '尹', '廿', '荫', '酋', '襄', '韦', '彦', '馨', '寅', '曰',
  '炯', '亨', '嘎', '黯', '嘛', '愣', '惟', '啪', '怡', '稣', '黏', '佐', '弘',
  '禅', '嘻', '尴', '尬', '耶', '藉', '麟', '魅',
]

const RARE_COMPONENTS = new Set([
  '𠃌', '𠃊', '𭠍', '𠂛', '𧘇', '𠂉', '𠃓', '𠃍', '𱼀', '𰆊',
  '𦍌', '𡗗', '𰀁', '𠕁', '𰀠', '𫠤', '𦣞', '𧰨', '𦈢', '𰀂',
])

describe('generated character structure data', () => {
  test('covers every playable character exactly once', () => {
    expect(structureByHanzi).toHaveLength(2974)
    expect(new Set(structureByHanzi.keys()).size).toBe(structureByHanzi.size)
    expect(characters).toHaveLength(2974)
    characters.forEach((character) => {
      expect(character.structure).toBe(requireCharacterStructure(character.hanzi))
    })
  })

  test('keeps a single learner-facing keyword without sense lists', () => {
    for (const structure of structureByHanzi.values()) {
      expect(structure.keyword).not.toMatch(/[,;]/)
      expect(structure.keyword.trim().length).toBeGreaterThan(0)
      for (const component of structure.components) {
        expect(component.keyword).not.toMatch(/[,;]/)
      }
    }
  })

  test('uses dictionary meanings and direct greedy components', () => {
    expect(requireCharacterStructure('一')).toEqual({
      hanzi: '一',
      keyword: 'один',
      primitive: null,
      components: [],
    })
    expect(requireCharacterStructure('二').components.map((component) => component.hanzi)).toEqual(['一', '一'])
    expect(requireCharacterStructure('学').components.map((component) => component.hanzi)).toEqual(['小', '冖', '子'])
    expect(requireCharacterStructure('猫').components.map((component) => component.hanzi)).toEqual(['犭', '艹', '田'])
  })

  test('keeps explicit keyword fallbacks without restoring RSH composition', () => {
    expect(Object.keys(keywordFallbacks)).toHaveLength(14)
    for (const [hanzi, fallback] of Object.entries(keywordFallbacks)) {
      expect(requireCharacterStructure(hanzi)).toMatchObject(fallback)
    }
    expect(requireCharacterStructure('奕').components.map((component) => component.hanzi)).toEqual(['亦', '大'])
    for (const hanzi of MISSING_GREEDY) {
      expect(requireCharacterStructure(hanzi).components).toEqual([])
    }
  })

  test('has a generated SVG for every IDS and rare Unicode component in play', () => {
    const required = new Set(
      characters.flatMap((character) => character.structure.components)
        .map((component) => component.hanzi)
        .filter((glyph) => glyph.startsWith('{') || RARE_COMPONENTS.has(glyph)),
    )
    const graphics = new Map(rawGraphics.map((graphic) => [graphic.glyph, graphic.fileName]))
    expect(new Set(graphics.keys())).toEqual(required)
    for (const fileName of graphics.values()) {
      expect(existsSync(resolve(import.meta.dir, `../public/assets/components/${fileName}.svg`))).toBe(true)
    }
  })
})
