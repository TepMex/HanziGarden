import rawStructure from './character_structure_ru.json'

export type CharacterComponent = {
  hanzi: string
  keyword: string
}

export type CharacterStructure = {
  hanzi: string
  keyword: string
  /** Legacy field name: this is the optional additional dictionary meaning. */
  primitive: string | null
  components: readonly CharacterComponent[]
}

const source = rawStructure as CharacterStructure[]

/** Keep catalog lookup and validation behind one stable domain boundary. */
export const structureByHanzi = new Map<string, CharacterStructure>()
for (const structure of source) {
  if (structureByHanzi.has(structure.hanzi)) {
    throw new Error(`Duplicate structure for ${structure.hanzi}`)
  }
  structureByHanzi.set(structure.hanzi, structure)
}

export function requireCharacterStructure(hanzi: string): CharacterStructure {
  const structure = structureByHanzi.get(hanzi)
  if (!structure) throw new Error(`Missing structure for ${hanzi}`)
  return structure
}
