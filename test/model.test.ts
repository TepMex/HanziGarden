import { describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beds, biomes, characters, sourceRthListIds } from '../src/data/model'

describe('garden model', () => {
  test('keeps the save-addressed character and bed identities stable', () => {
    expect(characters.map(({ id, hanzi, bedId, frame }) => ({ id, hanzi, bedId, frame })).filter(
      ({ frame }) => [1, 1000, 1487, 2974].includes(frame),
    )).toEqual([
      { id: 'rsh-0001', hanzi: '一', bedId: 'bed-001', frame: 1 },
      { id: 'rsh-1000', hanzi: '知', bedId: 'bed-063', frame: 1000 },
      { id: 'rsh-1487', hanzi: '扭', bedId: 'bed-109', frame: 1487 },
      { id: 'rsh-2974', hanzi: '傻', bedId: 'bed-220', frame: 2974 },
    ])
  })

  test('splits all 110 source lists into 220 ordered beds without losing characters', () => {
    expect(sourceRthListIds).toHaveLength(110)
    expect(beds).toHaveLength(220)
    expect(characters).toHaveLength(2974)
    expect(new Set(characters.map((character) => character.id)).size).toBe(2974)
    expect(new Set(beds.flatMap((bed) => bed.characterIds)).size).toBe(2974)

    sourceRthListIds.forEach((listId) => {
      const halves = beds.filter((bed) => bed.sourceRthListId === listId)
      expect(halves).toHaveLength(2)
      expect(halves.map((bed) => bed.sourceHalf)).toEqual([0, 1])
      expect(Math.abs(halves[0]!.characters.length - halves[1]!.characters.length)).toBeLessThanOrEqual(1)
      const frames = halves.flatMap((bed) => bed.characters.map((character) => character.frame))
      expect(frames).toEqual([...frames].sort((left, right) => left - right))
    })
  })

  test('occupies the garden geometry exactly once', () => {
    expect(biomes).toHaveLength(15)
    const cells = beds.flatMap((bed) => bed.cells)
    expect(cells).toHaveLength(225)
    expect(new Set(cells.map((cell) => `${cell.x}:${cell.y}`)).size).toBe(225)
    expect(cells.every((cell) => cell.x >= 0 && cell.x < 15 && cell.y >= 0 && cell.y < 15)).toBe(true)
    expect(beds.slice(0, 5).every((bed) => bed.cells.length === 2)).toBe(true)
    expect(beds.slice(5).every((bed) => bed.cells.length === 1)).toBe(true)
    expect(beds.filter((bed) => bed.biomeId === biomes[0]!.id)).toHaveLength(10)
    biomes.slice(1).forEach((biome) => {
      expect(beds.filter((bed) => bed.biomeId === biome.id)).toHaveLength(15)
    })
  })

  test('has symmetrical adjacency derived from shared cell edges', () => {
    const byId = new Map(beds.map((bed) => [bed.id, bed]))
    beds.forEach((bed) => bed.neighbors.forEach((neighborId) => {
      expect(byId.get(neighborId)?.neighbors).toContain(bed.id)
    }))
  })

  test('maps every character to pinyin and every available pronunciation to a local MP3', () => {
    const audioDirectory = fileURLToPath(new URL('../public/assets/audio/pinyin/', import.meta.url))
    const audioFiles = new Set(readdirSync(audioDirectory).filter((name) => name.endsWith('.mp3')))

    expect(audioFiles.size).toBe(1125)
    expect(characters.every((character) => character.pronunciation.pinyin.length > 0)).toBe(true)
    expect(characters.filter((character) => character.pronunciation.audioFile === null).map((character) => character.hanzi)).toEqual(['哟'])
    characters.forEach((character) => {
      if (character.pronunciation.audioFile) {
        expect(audioFiles.has(character.pronunciation.audioFile)).toBe(true)
      }
    })

    expect(characters.find((character) => character.hanzi === '一')?.pronunciation).toEqual({ pinyin: 'yī', audioFile: 'cmn-yi1.mp3' })
    expect(characters.find((character) => character.hanzi === '具')?.pronunciation).toEqual({ pinyin: 'jù', audioFile: 'cmn-jv4.mp3' })
    expect(characters.find((character) => character.hanzi === '的')?.pronunciation).toEqual({ pinyin: 'de', audioFile: 'cmn-de1.mp3' })
  })
})
