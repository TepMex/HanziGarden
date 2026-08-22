// PROTOTYPE — three inspection views of every battle keyword prompt, switchable via ?variant=.
// The route is read-only: it uses the production character catalogue and keeps CSS tuning in memory.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Search } from 'lucide-react'
import { characters, type CharacterDefinition } from '../data/model'
import './keywordPromptsPrototype.css'

type Variant = 'A' | 'B' | 'C'

type PromptSettings = {
  width: number
  minHeight: number
  paddingX: number
  paddingY: number
  keywordFontSize: number
  keywordMinFontSize: number
  keywordWeight: number
  keywordLineHeight: number
  keywordLetterSpacing: number
  primitiveMargin: number
  primitiveGap: number
  primitiveFontSize: number
  primitiveWeight: number
  primitiveOpacity: number
}

const variants: Array<{ key: Variant; name: string }> = [
  { key: 'A', name: 'Галерея' },
  { key: 'B', name: 'Длинные сначала' },
  { key: 'C', name: 'Аудит' },
]

const initialSettings: PromptSettings = {
  width: 390,
  minHeight: 82,
  paddingX: 32,
  paddingY: 12,
  keywordFontSize: 36.8,
  keywordMinFontSize: 10,
  keywordWeight: 600,
  keywordLineHeight: 1.08,
  keywordLetterSpacing: .035,
  primitiveMargin: 6,
  primitiveGap: 4,
  primitiveFontSize: 13.76,
  primitiveWeight: 500,
  primitiveOpacity: .62,
}

function readVariant(): Variant {
  const variant = new URLSearchParams(window.location.search).get('variant')
  return variant === 'B' || variant === 'C' ? variant : 'A'
}

function NumberSetting({
  label,
  value,
  suffix,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="keyword-setting">
      <span>{label}</span>
      <span className="keyword-setting-input">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  )
}

function cssSnippet(settings: PromptSettings): string {
  return `.prompt-scroll {
  width: min(${settings.width}px, 56vw);
  min-height: ${settings.minHeight}px;
  padding: ${settings.paddingY}px ${settings.paddingX}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #302820;
  background: linear-gradient(rgba(230, 217, 188, .97), rgba(203, 185, 149, .95));
  border: 1px solid rgba(104, 82, 46, .68);
  clip-path: polygon(8% 0, 92% 0, 100% 22%, 100% 78%, 92% 100%, 8% 100%, 0 78%, 0 22%);
  box-shadow: 0 10px 30px rgba(24, 24, 18, .38), inset 0 0 22px rgba(96, 66, 29, .14);
}

.prompt-scroll strong {
  font-size: clamp(${settings.keywordMinFontSize}px, 3vw, ${settings.keywordFontSize}px);
  font-weight: ${settings.keywordWeight};
  line-height: ${settings.keywordLineHeight};
  letter-spacing: ${settings.keywordLetterSpacing}em;
  overflow-wrap: normal;
  word-break: normal;
  text-align: center;
  text-wrap: balance;
}

.primitive-prompt {
  margin: ${settings.primitiveMargin}px 0 0;
  gap: ${settings.primitiveGap}px;
  line-height: 1.1;
  opacity: ${settings.primitiveOpacity};
}

.primitive-prompt b {
  font-size: ${settings.primitiveFontSize}px;
  font-weight: ${settings.primitiveWeight};
  overflow-wrap: anywhere;
}`
}

function SettingsPanel({
  settings,
  onChange,
  onReset,
}: {
  settings: PromptSettings
  onChange: (key: keyof PromptSettings, value: number) => void
  onReset: () => void
}) {
  const field = (key: keyof PromptSettings) => (value: number) => onChange(key, value)
  return (
    <aside className="keyword-settings-panel">
      <header>
        <div><span>Живые настройки</span><h2>CSS таблички</h2></div>
        <button type="button" onClick={onReset} title="Вернуть игровые значения"><RotateCcw size={17} /></button>
      </header>

      <fieldset>
        <legend>Контейнер</legend>
        <div className="keyword-settings-grid">
          <NumberSetting label="max-width" value={settings.width} suffix="px" min={160} onChange={field('width')} />
          <NumberSetting label="min-height" value={settings.minHeight} suffix="px" min={1} onChange={field('minHeight')} />
          <NumberSetting label="padding X" value={settings.paddingX} suffix="px" onChange={field('paddingX')} />
          <NumberSetting label="padding Y" value={settings.paddingY} suffix="px" onChange={field('paddingY')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Ключевое слово</legend>
        <div className="keyword-settings-grid">
          <NumberSetting label="font-size max" value={settings.keywordFontSize} suffix="px" min={8} step={.1} onChange={field('keywordFontSize')} />
          <NumberSetting label="font-size min" value={settings.keywordMinFontSize} suffix="px" min={8} step={.5} onChange={field('keywordMinFontSize')} />
          <NumberSetting label="font-weight" value={settings.keywordWeight} min={100} max={900} step={100} onChange={field('keywordWeight')} />
          <NumberSetting label="line-height" value={settings.keywordLineHeight} min={.5} step={.01} onChange={field('keywordLineHeight')} />
          <NumberSetting label="letter-spacing" value={settings.keywordLetterSpacing} suffix="em" step={.005} onChange={field('keywordLetterSpacing')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Примитив</legend>
        <div className="keyword-settings-grid">
          <NumberSetting label="margin-top" value={settings.primitiveMargin} suffix="px" onChange={field('primitiveMargin')} />
          <NumberSetting label="gap" value={settings.primitiveGap} suffix="px" onChange={field('primitiveGap')} />
          <NumberSetting label="font-size" value={settings.primitiveFontSize} suffix="px" min={6} step={.1} onChange={field('primitiveFontSize')} />
          <NumberSetting label="font-weight" value={settings.primitiveWeight} min={100} max={900} step={100} onChange={field('primitiveWeight')} />
          <NumberSetting label="opacity" value={settings.primitiveOpacity} min={0} max={1} step={.01} onChange={field('primitiveOpacity')} />
        </div>
      </fieldset>

      <div className="keyword-css-block">
        <b>Итоговый CSS</b>
        <code>{cssSnippet(settings)}</code>
      </div>
      <p className="keyword-settings-note">Исходные значения взяты с экрана рисования. Абсолютное позиционирование убрано только для размещения табличек в каталоге.</p>
    </aside>
  )
}

function PromptPreview({ character, audit = false }: { character: CharacterDefinition; audit?: boolean }) {
  const primitive = character.structure.primitive
  return (
    <article className={`keyword-prompt-record ${primitive ? 'has-primitive' : ''}`} data-frame={character.frame}>
      {audit && (
        <div className="keyword-audit-meta">
          <b>#{character.frame}</b>
          <span className="keyword-audit-hanzi">{character.hanzi}</span>
          <span>{character.keyword.ru.length} зн.</span>
          <span>{primitive ? `${primitive.length} зн. примитива` : 'без примитива'}</span>
        </div>
      )}
      <header className="prompt-scroll keyword-prompt-preview">
        <strong>{character.keyword.ru.toLocaleUpperCase('ru')}</strong>
        {primitive && (
          <p className="primitive-prompt">
            <Plus size={13} aria-hidden="true" />
            <b>{primitive}</b>
          </p>
        )}
      </header>
      {!audit && (
        <footer>
          <b>#{character.frame}</b>
          <span>{character.hanzi}</span>
          <small>{primitive ? 'ключ + примитив' : 'ключ'}</small>
        </footer>
      )}
    </article>
  )
}

function VariantSwitcher({ current, onChange }: { current: Variant; onChange: (variant: Variant) => void }) {
  const cycle = useCallback((direction: -1 | 1) => {
    const index = variants.findIndex((variant) => variant.key === current)
    onChange(variants[(index + direction + variants.length) % variants.length]!.key)
  }, [current, onChange])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('input, textarea, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cycle])

  const active = variants.find((variant) => variant.key === current)!
  return (
    <nav className="keyword-variant-switcher" aria-label="Варианты отладочной страницы">
      <button type="button" onClick={() => cycle(-1)} aria-label="Предыдущий вариант"><ChevronLeft size={18} /></button>
      <span><b>{active.key}</b> — {active.name}</span>
      <button type="button" onClick={() => cycle(1)} aria-label="Следующий вариант"><ChevronRight size={18} /></button>
    </nav>
  )
}

export function KeywordPromptsPrototype() {
  const [variant, setVariant] = useState<Variant>(readVariant)
  const [settings, setSettings] = useState<PromptSettings>(initialSettings)
  const [query, setQuery] = useState('')
  const [primitiveOnly, setPrimitiveOnly] = useState(false)
  const promptRootRef = useRef<HTMLElement>(null)

  const matchingCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru')
    const matching = characters.filter((character) => {
      if (primitiveOnly && !character.structure.primitive) return false
      if (!normalizedQuery) return true
      return [String(character.frame), character.hanzi, character.keyword.ru, character.structure.primitive ?? '']
        .some((value) => value.toLocaleLowerCase('ru').includes(normalizedQuery))
    })
    if (variant === 'B') {
      return [...matching].sort((left, right) => {
        const leftLength = left.keyword.ru.length + (left.structure.primitive?.length ?? 0)
        const rightLength = right.keyword.ru.length + (right.structure.primitive?.length ?? 0)
        return rightLength - leftLength || left.frame - right.frame
      })
    }
    if (variant === 'C') {
      return [...matching].sort((left, right) => {
        if (Boolean(left.structure.primitive) !== Boolean(right.structure.primitive)) return left.structure.primitive ? -1 : 1
        return left.frame - right.frame
      })
    }
    return matching
  }, [primitiveOnly, query, variant])

  useEffect(() => {
    const root = promptRootRef.current
    if (!root) return
    const frame = window.requestAnimationFrame(() => {
      const prompts = root.querySelectorAll<HTMLElement>('.keyword-prompt-preview strong')
      const maximum = Math.max(settings.keywordFontSize, settings.keywordMinFontSize)
      const minimum = Math.min(settings.keywordFontSize, settings.keywordMinFontSize)
      prompts.forEach((prompt) => {
        let low = Math.ceil(minimum * 2)
        let high = Math.floor(maximum * 2)
        let chosen = low
        while (low <= high) {
          const candidate = Math.floor((low + high) / 2)
          prompt.style.fontSize = `${candidate / 2}px`
          const style = getComputedStyle(prompt)
          const lineHeight = Number.parseFloat(style.lineHeight)
          const lines = Math.ceil(prompt.getBoundingClientRect().height / lineHeight - .01)
          if (lines <= 3 && prompt.scrollWidth <= prompt.clientWidth + .5) {
            chosen = candidate
            low = candidate + 1
          } else {
            high = candidate - 1
          }
        }
        prompt.style.fontSize = `${chosen / 2}px`
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [matchingCharacters, settings])

  const changeVariant = useCallback((next: Variant) => {
    const search = new URLSearchParams(window.location.search)
    search.set('variant', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${search}`)
    setVariant(next)
  }, [])

  const changeSetting = useCallback((key: keyof PromptSettings, value: number) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }, [])

  const prototypeStyle = {
    '--keyword-prompt-width': `${settings.width}px`,
    '--keyword-prompt-min-height': `${settings.minHeight}px`,
    '--keyword-prompt-padding-x': `${settings.paddingX}px`,
    '--keyword-prompt-padding-y': `${settings.paddingY}px`,
    '--keyword-font-size': `${settings.keywordFontSize}px`,
    '--keyword-font-weight': settings.keywordWeight,
    '--keyword-line-height': settings.keywordLineHeight,
    '--keyword-letter-spacing': `${settings.keywordLetterSpacing}em`,
    '--primitive-margin': `${settings.primitiveMargin}px`,
    '--primitive-gap': `${settings.primitiveGap}px`,
    '--primitive-font-size': `${settings.primitiveFontSize}px`,
    '--primitive-font-weight': settings.primitiveWeight,
    '--primitive-opacity': settings.primitiveOpacity,
  } as CSSProperties

  const prompts = matchingCharacters.map((character) => (
    <PromptPreview character={character} audit={variant === 'C'} key={character.id} />
  ))

  return (
    <main className={`keyword-prompts-prototype keyword-prompts-variant-${variant.toLowerCase()}`} style={prototypeStyle}>
      <header className="keyword-prototype-title">
        <div><span>PROTOTYPE · DEV ONLY</span><h1>Ключевые слова</h1></div>
        <p>Все таблички из каталога персонажей: {characters.length.toLocaleString('ru-RU')} ключевых слов, из них {characters.filter((character) => character.structure.primitive).length} с дополнительным значением.</p>
      </header>

      <section className="keyword-filter-bar">
        <label className="keyword-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ключ, примитив, иероглиф или номер" />
        </label>
        <label className="keyword-primitive-filter">
          <input type="checkbox" checked={primitiveOnly} onChange={(event) => setPrimitiveOnly(event.target.checked)} />
          Только с примитивом
        </label>
        <output>{matchingCharacters.length.toLocaleString('ru-RU')} табличек</output>
      </section>

      <section className="keyword-prototype-content" ref={promptRootRef}>
        {variant === 'A' && (
          <>
            <SettingsPanel settings={settings} onChange={changeSetting} onReset={() => setSettings(initialSettings)} />
            <div className="keyword-prompt-gallery">{prompts}</div>
          </>
        )}

        {variant === 'B' && (
          <>
            <SettingsPanel settings={settings} onChange={changeSetting} onReset={() => setSettings(initialSettings)} />
            <div className="keyword-prompt-length-list">{prompts}</div>
          </>
        )}

        {variant === 'C' && (
          <>
            <div className="keyword-audit-list">{prompts}</div>
            <SettingsPanel settings={settings} onChange={changeSetting} onReset={() => setSettings(initialSettings)} />
          </>
        )}

        {matchingCharacters.length === 0 && <p className="keyword-empty-state">Ничего не найдено.</p>}
      </section>

      <VariantSwitcher current={variant} onChange={changeVariant} />
    </main>
  )
}
