// Content editor — development utility for character catalogs and achievement formulas.
// The route never loads or mutates player progress; it only reads/writes JSON documents.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileJson, FolderOpen, Plus, Search, Trash2 } from 'lucide-react'
import rawAchievementCatalog from '../data/achievements.json'
import rawStructureCatalog from '../data/rsh_structure_ru.json'
import {
  openContentDocument,
  serializeContentDocument,
  updateAchievementFormula,
  updateCharacterStructure,
  type AchievementAwardFormula,
  type AchievementCatalogDocument,
  type AchievementEventType,
  type CharacterComponentDraft,
  type CharacterStructureDocument,
  type ContentDocument,
} from './document'
import './contentEditor.css'

const EVENT_OPTIONS: Array<{ value: AchievementEventType; label: string }> = [
  { value: 'kanji.completed', label: 'kanji.completed' },
  { value: 'gardenBed.completed', label: 'gardenBed.completed' },
  { value: 'session.activeTime', label: 'session.activeTime' },
  { value: 'player.migrated', label: 'player.migrated' },
]

const bundledAssets = [
  { fileName: 'rsh_structure_ru.json', label: 'Каталог иероглифов', source: rawStructureCatalog, pretty: false },
  { fileName: 'achievements.json', label: 'Каталог достижений', source: rawAchievementCatalog, pretty: true },
]

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function kindLabel(kind: ContentDocument['kind']): string {
  return kind === 'character-structure' ? 'Иероглифы' : 'Достижения'
}

export function ContentEditor() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [documentState, setDocumentState] = useState<ContentDocument | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const openText = (fileName: string, text: string) => {
    try {
      const next = openContentDocument(fileName, text)
      setDocumentState(next)
      setSelectedId(firstEntryId(next))
      setQuery('')
      setError(null)
      setDirty(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось открыть файл')
    }
  }

  const entries = useMemo(() => documentState ? listEntries(documentState, query) : [], [documentState, query])

  return (
    <main className="content-editor">
      <header className="content-editor-title">
        <div>
          <span>УТИЛИТА · DEV ONLY</span>
          <h1>Редактор контента</h1>
        </div>
        <p>
          Откройте игровой JSON, измените ключевые слова, примитивы, состав иероглифа или формулу достижения
          и сохраните файл, чтобы затем заменить им исходный ассет.
        </p>
      </header>

      <section className="content-editor-toolbar">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void file.text().then((text) => openText(file.name, text))
          }}
        />
        <button type="button" onClick={() => fileInput.current?.click()}>
          <FolderOpen size={16} /> Открыть файл
        </button>
        {bundledAssets.map((asset) => (
          <button type="button" key={asset.fileName} onClick={() => openText(asset.fileName, JSON.stringify(asset.source, null, asset.pretty ? 2 : undefined))}>
            <FileJson size={16} /> {asset.label}
          </button>
        ))}
        <button
          type="button"
          className="is-primary"
          disabled={!documentState}
          onClick={() => {
            if (!documentState) return
            downloadText(documentState.fileName, serializeContentDocument(documentState))
            setDirty(false)
          }}
        >
          <Download size={16} /> Сохранить файл
        </button>
        <output>
          {documentState ? `${kindLabel(documentState.kind)} · ${documentState.fileName}${dirty ? ' · есть изменения' : ''}` : 'Файл не выбран'}
        </output>
      </section>

      {error && <p className="content-editor-error" role="alert">{error}</p>}

      {!documentState && (
        <p className="content-editor-empty">Выберите JSON из игровых ассетов — каталог иероглифов или каталог достижений.</p>
      )}

      {documentState && (
        <section className="content-editor-workspace">
          <aside>
            <label className="content-editor-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по каталогу" />
            </label>
            <output>{entries.length.toLocaleString('ru-RU')}</output>
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={entry.id === selectedId ? 'is-selected' : undefined}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <b>{entry.mark}</b>
                    <span>{entry.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="content-editor-detail">
            {documentState.kind === 'character-structure' && (
              <CharacterEditor
                document={documentState}
                selectedId={selectedId}
                onChange={(next) => {
                  setDocumentState(next)
                  setDirty(true)
                  setError(null)
                }}
                onError={setError}
              />
            )}
            {documentState.kind === 'achievement-catalog' && (
              <AchievementEditor
                document={documentState}
                selectedId={selectedId}
                onChange={(next) => {
                  setDocumentState(next)
                  setDirty(true)
                  setError(null)
                }}
                onError={setError}
              />
            )}
          </div>
        </section>
      )}
    </main>
  )
}

function CharacterEditor({
  document,
  selectedId,
  onChange,
  onError,
}: {
  document: CharacterStructureDocument
  selectedId: string | null
  onChange: (document: CharacterStructureDocument) => void
  onError: (message: string | null) => void
}) {
  const entry = document.entries.find((item) => item.hanzi === selectedId)
  if (!entry) return <p className="content-editor-empty">Выберите иероглиф слева.</p>

  const apply = (patch: Parameters<typeof updateCharacterStructure>[2]) => {
    try {
      onChange(updateCharacterStructure(document, entry.hanzi, patch))
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Не удалось сохранить правку')
    }
  }

  return (
    <article>
      <header>
        <span>Иероглиф</span>
        <h2>{entry.hanzi}</h2>
      </header>
      <label>
        <span>Ключевое слово</span>
        <input value={entry.keyword} onChange={(event) => apply({ keyword: event.target.value })} />
      </label>
      <label>
        <span>Дополнительное (примитивное) значение</span>
        <input
          value={entry.primitive ?? ''}
          placeholder="нет"
          onChange={(event) => apply({ primitive: event.target.value })}
        />
      </label>
      <fieldset>
        <legend>Состав</legend>
        {entry.components.map((component, index) => (
          <div className="content-editor-component" key={`${component.hanzi}:${index}`}>
            <input
              aria-label="Иероглиф компонента"
              value={component.hanzi}
              onChange={(event) => apply({ components: replaceComponent(entry.components, index, { ...component, hanzi: event.target.value }) })}
            />
            <input
              aria-label="Ключевое слово компонента"
              value={component.keyword}
              onChange={(event) => apply({ components: replaceComponent(entry.components, index, { ...component, keyword: event.target.value }) })}
            />
            <button type="button" aria-label="Удалить компонент" onClick={() => apply({ components: entry.components.filter((_, itemIndex) => itemIndex !== index) })}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => apply({ components: [...entry.components, { hanzi: '组', keyword: 'компонент' }] })}>
          <Plus size={15} /> Добавить компонент
        </button>
      </fieldset>
    </article>
  )
}

function AchievementEditor({
  document,
  selectedId,
  onChange,
  onError,
}: {
  document: AchievementCatalogDocument
  selectedId: string | null
  onChange: (document: AchievementCatalogDocument) => void
  onError: (message: string | null) => void
}) {
  const entry = document.achievements.find((item) => item.id === selectedId)
  const [draftWhen, setDraftWhen] = useState(entry?.formula.when ?? '')
  useEffect(() => {
    setDraftWhen(entry?.formula.when ?? '')
    onError(null)
  }, [entry?.id, entry?.formula.when, onError])
  if (!entry) return <p className="content-editor-empty">Выберите достижение слева.</p>

  const apply = (formula: AchievementAwardFormula) => {
    try {
      onChange(updateAchievementFormula(document, entry.id, formula))
      onError(null)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Не удалось сохранить формулу')
    }
  }

  return (
    <article>
      <header>
        <span>{entry.category}{entry.secret ? ' · секрет' : ''}</span>
        <h2>{entry.title}</h2>
        <p>{entry.description}</p>
      </header>
      <fieldset>
        <legend>События</legend>
        <div className="content-editor-events">
          {EVENT_OPTIONS.map((option) => {
            const checked = entry.formula.on.includes(option.value)
            return (
              <label key={option.value}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const on = checked
                      ? entry.formula.on.filter((item) => item !== option.value)
                      : [...entry.formula.on, option.value]
                    apply({ on, when: draftWhen })
                  }}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>
      <label>
        <span>Формула выдачи</span>
        <textarea
          rows={5}
          value={draftWhen}
          spellCheck={false}
          onChange={(event) => {
            const when = event.target.value
            setDraftWhen(when)
            apply({ ...entry.formula, when })
          }}
        />
      </label>
      <p className="content-editor-note">
        Доступны пути <code>event</code>, <code>player</code>, <code>session</code>, <code>persistence</code>,
        <code> daysSinceLastActive</code> и функции <code>includes</code>, <code>length</code>.
      </p>
    </article>
  )
}

function firstEntryId(document: ContentDocument): string | null {
  return document.kind === 'character-structure'
    ? document.entries[0]?.hanzi ?? null
    : document.achievements[0]?.id ?? null
}

function listEntries(document: ContentDocument, query: string): Array<{ id: string; mark: string; label: string }> {
  const needle = query.trim().toLocaleLowerCase('ru')
  const matches = (values: string[]) => !needle || values.some((value) => value.toLocaleLowerCase('ru').includes(needle))
  if (document.kind === 'character-structure') {
    return document.entries
      .filter((entry) => matches([entry.hanzi, entry.keyword, entry.primitive ?? '', ...entry.components.flatMap((item) => [item.hanzi, item.keyword])]))
      .map((entry) => ({ id: entry.hanzi, mark: entry.hanzi, label: entry.keyword }))
  }
  return document.achievements
    .filter((entry) => matches([entry.id, entry.title, entry.description, entry.formula.when]))
    .map((entry) => ({ id: entry.id, mark: entry.secret ? '秘' : '成', label: entry.title }))
}

function replaceComponent(components: readonly CharacterComponentDraft[], index: number, next: CharacterComponentDraft) {
  return components.map((item, itemIndex) => itemIndex === index ? next : item)
}
