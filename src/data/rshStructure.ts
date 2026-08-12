import rawStructure from './rsh_structure_ru.json'

export type CharacterComponent = {
  hanzi: string
  keyword: string
}

export type CharacterStructure = {
  hanzi: string
  keyword: string
  primitive: string | null
  components: readonly CharacterComponent[]
}

const source = rawStructure as CharacterStructure[]

/**
 * The structure data is kept behind this index so callers never need to know
 * about the JSON file or duplicate its lookup rules.
 */
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
