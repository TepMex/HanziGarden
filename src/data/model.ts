import rawCharacters from './rth.json'
import rawPinyinAudio from './pinyinAudio.json'
import type { PinyinPronunciation } from '../pinyinAudio'
import { isHsk1Variant } from '../appVariant'
import { HSK1_VARIANT_CHARACTERS } from './hsk1Variant'
import { requireCharacterStructure, type CharacterStructure } from './rshStructure'
import {
  cellsForBedIndex,
  biomes,
  biomeForCell,
  type Biome,
  type GridCell,
} from './mapLayout'

export type CharacterDefinition = {
  id: string
  hanzi: string
  keyword: { ru: string; en: string }
  frame: number
  bedId: string
  strokeCount: number
  writingDataId: string
  structure: CharacterStructure
  pronunciation: PinyinPronunciation
}

export type BedDefinition = {
  id: string
  sourceRthListId: string
  sourceHalf: 0 | 1
  biomeId: string
  characterIds: string[]
  characters: CharacterDefinition[]
  cells: GridCell[]
  neighbors: string[]
  seed: number
}

type RawCharacter = {
  frame: number
  hanzi: string
  keyword: string
  rth_list: string
  lesson: number
  strokes: number
  rth_list_name: string
}

type BedDraft = Omit<BedDefinition, 'characters' | 'characterIds' | 'neighbors'> & {
  rawCharacters: RawCharacter[]
}

const source = rawCharacters as RawCharacter[]
const pronunciationByFrame = rawPinyinAudio as Array<[string, string | null]>
if (pronunciationByFrame.length !== source.length) {
  throw new Error('Pinyin pronunciation data must match the RSH character source')
}
export const sourceRthListIds = [...new Set(source.map((item) => item.rth_list))]

/** Stable v1 IDs are retained only for lossless save migration. */
export const legacyFieldIdBySourceRthListId = new Map(
  sourceRthListIds.map((listId, index) => [listId, `field-${String(index + 1).padStart(3, '0')}`]),
)

const rawCharactersByList = new Map<string, RawCharacter[]>()
for (const item of source) {
  const list = rawCharactersByList.get(item.rth_list) ?? []
  list.push(item)
  rawCharactersByList.set(item.rth_list, list)
}

function draftForCharacters(
  bedIndex: number,
  rawCharacters: RawCharacter[],
  sourceRthListId: string,
  sourceHalf: 0 | 1,
): BedDraft {
  const cells = cellsForBedIndex(bedIndex)
  return {
    id: `bed-${String(bedIndex + 1).padStart(3, '0')}`,
    sourceRthListId,
    sourceHalf,
    biomeId: biomeForCell(cells[0]!).id,
    rawCharacters,
    cells,
    seed: (bedIndex + 1) * 2654435761,
  }
}

function buildMainDrafts(): BedDraft[] {
  const result: BedDraft[] = []
  for (const [listIndex, listId] of sourceRthListIds.entries()) {
    const listCharacters = [...(rawCharactersByList.get(listId) ?? [])].sort((left, right) => left.frame - right.frame)
    const splitIndex = Math.ceil(listCharacters.length / 2)
    for (const sourceHalf of [0, 1] as const) {
      result.push(draftForCharacters(
        result.length,
        sourceHalf === 0 ? listCharacters.slice(0, splitIndex) : listCharacters.slice(splitIndex),
        listId,
        sourceHalf,
      ))
    }
    // This makes an accidental reordering above fail loudly during development.
    if (result.length !== (listIndex + 1) * 2) throw new Error('Each RTH list must create exactly two beds')
  }
  return result
}

function buildHsk1Drafts(): BedDraft[] {
  const rawByHanzi = new Map(source.map((item) => [item.hanzi, item]))
  return HSK1_VARIANT_CHARACTERS.map((hanzi, bedIndex) => {
    const item = rawByHanzi.get(hanzi)
    if (!item) throw new Error(`Missing RSH data for HSK Hanzi ${hanzi}`)
    return draftForCharacters(bedIndex, [item], item.rth_list, 0)
  })
}

const drafts = isHsk1Variant ? buildHsk1Drafts() : buildMainDrafts()

const characterByBedAndFrame = new Map<string, CharacterDefinition>()
for (const draft of drafts) {
  for (const item of draft.rawCharacters) {
    const pronunciation = pronunciationByFrame[item.frame - 1]
    if (!pronunciation) throw new Error(`Нет пиньиня для ${item.hanzi}`)
    const structure = requireCharacterStructure(item.hanzi)
    const character: CharacterDefinition = {
      id: `rsh-${String(item.frame).padStart(4, '0')}`,
      hanzi: item.hanzi,
      keyword: { ru: structure.keyword, en: item.keyword },
      frame: item.frame,
      bedId: draft.id,
      strokeCount: item.strokes,
      writingDataId: item.hanzi,
      structure,
      pronunciation: { pinyin: pronunciation[0], audioFile: pronunciation[1] },
    }
    characterByBedAndFrame.set(`${draft.id}:${item.frame}`, character)
  }
}

function buildNeighbors(draftsToLink: readonly BedDraft[]): Map<string, string[]> {
  const bedIdByCell = new Map<string, string>()
  for (const draft of draftsToLink) {
    for (const cell of draft.cells) {
      const key = `${cell.x}:${cell.y}`
      if (bedIdByCell.has(key)) throw new Error(`Overlapping garden cell ${key}`)
      bedIdByCell.set(key, draft.id)
    }
  }

  const neighbors = new Map(draftsToLink.map((draft) => [draft.id, new Set<string>()]))
  for (const draft of draftsToLink) {
    for (const cell of draft.cells) {
      for (const [deltaX, deltaY] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const adjacentId = bedIdByCell.get(`${cell.x + deltaX}:${cell.y + deltaY}`)
        if (adjacentId && adjacentId !== draft.id) {
          neighbors.get(draft.id)!.add(adjacentId)
          neighbors.get(adjacentId)!.add(draft.id)
        }
      }
    }
  }
  return new Map([...neighbors].map(([id, ids]) => [id, [...ids].sort()]))
}

const neighborIdsByBedId = buildNeighbors(drafts)
export const beds: BedDefinition[] = drafts.map(({ rawCharacters, ...draft }) => {
  const characters = rawCharacters.map((item) => characterByBedAndFrame.get(`${draft.id}:${item.frame}`)!)
  return {
    ...draft,
    characters,
    characterIds: characters.map((character) => character.id),
    neighbors: neighborIdsByBedId.get(draft.id)!,
  }
})

export const characters = [...beds]
  .flatMap((bed) => bed.characters)
  .sort((left, right) => left.frame - right.frame)

export const bedById = new Map(beds.map((bed) => [bed.id, bed]))
export const characterById = new Map(characters.map((character) => [character.id, character]))
const legacyBedEntries: Array<[string, [string, string]]> = isHsk1Variant
  ? []
  : sourceRthListIds.map((listId, index) => [
    legacyFieldIdBySourceRthListId.get(listId)!,
    [beds[index * 2]!.id, beds[index * 2 + 1]!.id],
  ])
export const bedIdsByLegacyFieldId = new Map(legacyBedEntries)

export { biomes }
export type { Biome }
