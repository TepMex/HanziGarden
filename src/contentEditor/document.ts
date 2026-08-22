import { parseAchievementFormula } from '../data/achievementFormula'

export type AchievementEventType = 'kanji.completed' | 'gardenBed.completed' | 'session.activeTime' | 'player.migrated'
export type AchievementCategory = 'daily' | 'combo' | 'biome' | 'session' | 'writing' | 'statistics' | 'recovery' | 'secret'
export type AchievementProgressType = 'boolean' | 'counter' | 'max' | 'streak'

export type CharacterComponentDraft = {
  hanzi: string
  keyword: string
}

export type CharacterStructureDraft = {
  hanzi: string
  keyword: string
  primitive: string | null
  components: CharacterComponentDraft[]
}

export type AchievementAwardFormula = {
  on: AchievementEventType[]
  when: string
}

export type AchievementCatalogEntry = {
  id: string
  category: AchievementCategory
  title: string
  description: string
  secret: boolean
  progressType: AchievementProgressType
  target?: number
  badge: { atlas: 'category' | 'biome'; index: number }
  formula: AchievementAwardFormula
}

export type CharacterStructureDocument = {
  kind: 'character-structure'
  fileName: string
  pretty: boolean
  entries: CharacterStructureDraft[]
}

export type AchievementCatalogDocument = {
  kind: 'achievement-catalog'
  fileName: string
  pretty: boolean
  version: number
  achievements: AchievementCatalogEntry[]
}

export type ContentDocument = CharacterStructureDocument | AchievementCatalogDocument

const EVENT_TYPES = new Set<AchievementEventType>([
  'kanji.completed',
  'gardenBed.completed',
  'session.activeTime',
  'player.migrated',
])

export function openContentDocument(fileName: string, text: string): ContentDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw contentError('файл должен быть JSON с игровым контентом')
  }

  const pretty = /^\s*[\{\[]\s*\n/.test(text)
  if (isAchievementCatalog(parsed)) {
    return {
      kind: 'achievement-catalog',
      fileName,
      pretty,
      version: parsed.version,
      achievements: parsed.achievements.map(readAchievement),
    }
  }
  if (isCharacterStructureCatalog(parsed)) {
    return {
      kind: 'character-structure',
      fileName,
      pretty,
      entries: parsed.map(readStructure),
    }
  }
  throw contentError('неизвестный формат игрового ассета')
}

export function updateCharacterStructure(
  document: CharacterStructureDocument,
  hanzi: string,
  patch: Partial<Pick<CharacterStructureDraft, 'keyword' | 'primitive' | 'components'>>,
): CharacterStructureDocument {
  const index = document.entries.findIndex((entry) => entry.hanzi === hanzi)
  if (index < 0) throw contentError(`иероглиф ${hanzi} не найден`)
  const current = document.entries[index]!
  const next = {
    ...current,
    keyword: patch.keyword === undefined ? current.keyword : readKeyword(patch.keyword),
    primitive: patch.primitive === undefined ? current.primitive : readPrimitive(patch.primitive),
    components: patch.components === undefined ? current.components : patch.components.map(readComponent),
  }
  return {
    ...document,
    entries: document.entries.map((entry, entryIndex) => entryIndex === index ? next : entry),
  }
}

export function updateAchievementFormula(
  document: AchievementCatalogDocument,
  id: string,
  formula: AchievementAwardFormula,
): AchievementCatalogDocument {
  const index = document.achievements.findIndex((entry) => entry.id === id)
  if (index < 0) throw contentError(`достижение ${id} не найдено`)
  const nextFormula = readFormula(formula)
  return {
    ...document,
    achievements: document.achievements.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, formula: nextFormula } : entry
    )),
  }
}

export function serializeContentDocument(document: ContentDocument): string {
  const indent = document.pretty ? 2 : undefined
  if (document.kind === 'character-structure') {
    return JSON.stringify(document.entries, null, indent)
  }
  return JSON.stringify({
    kind: 'hanzi-garden.achievements',
    version: document.version,
    achievements: document.achievements,
  }, null, indent)
}

function isAchievementCatalog(value: unknown): value is { version: number; achievements: unknown[] } {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as { kind?: unknown }).kind === 'hanzi-garden.achievements'
    && typeof (value as { version?: unknown }).version === 'number'
    && Array.isArray((value as { achievements?: unknown }).achievements),
  )
}

function isCharacterStructureCatalog(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => (
    item
    && typeof item === 'object'
    && typeof (item as { hanzi?: unknown }).hanzi === 'string'
    && typeof (item as { keyword?: unknown }).keyword === 'string'
    && Array.isArray((item as { components?: unknown }).components)
    && ('primitive' in item)
  ))
}

function readStructure(value: unknown): CharacterStructureDraft {
  if (!value || typeof value !== 'object') throw contentError('запись иероглифа повреждена')
  const record = value as Record<string, unknown>
  return {
    hanzi: readRequiredString(record.hanzi, 'hanzi'),
    keyword: readKeyword(record.keyword),
    primitive: readPrimitive(record.primitive),
    components: Array.isArray(record.components) ? record.components.map(readComponent) : [],
  }
}

function readAchievement(value: unknown): AchievementCatalogEntry {
  if (!value || typeof value !== 'object') throw contentError('запись достижения повреждена')
  const record = value as Record<string, unknown>
  const badge = record.badge
  if (!badge || typeof badge !== 'object') throw contentError('у достижения нет значка')
  const badgeRecord = badge as Record<string, unknown>
  return {
    id: readRequiredString(record.id, 'id'),
    category: readRequiredString(record.category, 'category') as AchievementCategory,
    title: readRequiredString(record.title, 'title'),
    description: readRequiredString(record.description, 'description'),
    secret: Boolean(record.secret),
    progressType: readRequiredString(record.progressType, 'progressType') as AchievementProgressType,
    target: typeof record.target === 'number' ? record.target : undefined,
    badge: {
      atlas: badgeRecord.atlas === 'biome' ? 'biome' : 'category',
      index: typeof badgeRecord.index === 'number' ? badgeRecord.index : 0,
    },
    formula: readFormula(record.formula),
  }
}

function readFormula(value: unknown): AchievementAwardFormula {
  if (!value || typeof value !== 'object') throw contentError('у достижения нет формулы')
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.on) || record.on.length === 0 || record.on.some((item) => !EVENT_TYPES.has(item as AchievementEventType))) {
    throw contentError('формула должна слушать известные игровые события')
  }
  const when = readRequiredString(record.when, 'when')
  parseAchievementFormula(when)
  return { on: [...new Set(record.on as AchievementEventType[])], when }
}

function readComponent(value: unknown): CharacterComponentDraft {
  if (!value || typeof value !== 'object') throw contentError('компонент иероглифа повреждён')
  const record = value as Record<string, unknown>
  return {
    hanzi: readRequiredString(record.hanzi, 'component.hanzi'),
    keyword: readKeyword(record.keyword),
  }
}

function readKeyword(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw contentError('ключевое слово не может быть пустым')
  return value.trim()
}

function readPrimitive(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw contentError('примитивное значение должно быть строкой')
  return value.trim() || null
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw contentError(`поле ${field} должно быть непустой строкой`)
  return value.trim()
}

function contentError(detail: string): Error {
  return new Error(`Некорректный игровой контент: ${detail}`)
}
