// PROTOTYPE — three views of the biome badge sprite, switchable via ?variant=.
// No save-game data or persistence is used on this route.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'
import { ACHIEVEMENTS, type AchievementDefinition } from '../achievements'
import { assetUrl } from '../assetUrl'
import './biomeBadgesPrototype.css'

type Variant = 'A' | 'B' | 'C'

type SpriteSettings = {
  badgeWidth: number
  badgeHeight: number
  backgroundWidth: number
  backgroundHeight: number
  borderRadius: number
  columns: number
  rows: number
  xDivisor: number
  yDivisor: number
  offsetX: number
  offsetY: number
}

const variants: Array<{ key: Variant; name: string }> = [
  { key: 'A', name: 'Галерея' },
  { key: 'B', name: 'Атлас' },
  { key: 'C', name: 'Формула' },
]

const initialSettings: SpriteSettings = {
  badgeWidth: 162,
  badgeHeight: 180,
  backgroundWidth: 500,
  backgroundHeight: 300,
  borderRadius: 48,
  columns: 5,
  rows: 3,
  xDivisor: 4,
  yDivisor: 2,
  offsetX: 0,
  offsetY: 0,
}

const biomeAchievements = ACHIEVEMENTS.filter((achievement) => achievement.badge.atlas === 'biome')
const spriteUrl = assetUrl('assets/achievements/biome-badges.png')

function readVariant(): Variant {
  const variant = new URLSearchParams(window.location.search).get('variant')
  return variant === 'B' || variant === 'C' ? variant : 'A'
}

function spriteMetrics(index: number, settings: SpriteSettings) {
  const column = index % settings.columns
  const row = Math.floor(index / settings.columns)
  const x = settings.offsetX + column / settings.xDivisor * 100
  const y = settings.offsetY + row / settings.yDivisor * 100
  return { column, row, x, y }
}

function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`
}

function SpriteBadge({ achievement, settings }: { achievement: AchievementDefinition; settings: SpriteSettings }) {
  const { x, y } = spriteMetrics(achievement.badge.index, settings)
  return (
    <span
      className="biome-sprite-preview"
      style={{
        width: settings.badgeWidth,
        height: settings.badgeHeight,
        borderRadius: `${settings.borderRadius}%`,
        backgroundImage: `url(${JSON.stringify(spriteUrl)})`,
        backgroundSize: `${settings.backgroundWidth}% ${settings.backgroundHeight}%`,
        backgroundPosition: `${x}% ${y}%`,
      }}
      aria-hidden="true"
    />
  )
}

function PopupPreview({ achievement, settings }: { achievement: AchievementDefinition; settings: SpriteSettings }) {
  return (
    <figure className="biome-popup-figure">
      <figcaption>
        <b>#{achievement.badge.index}</b>
        <span>{spriteMetrics(achievement.badge.index, settings).column}:{spriteMetrics(achievement.badge.index, settings).row}</span>
      </figcaption>
      <section className="achievement-popup biome-prototype-popup">
        <div className="achievement-seal">成</div>
        <p className="achievement-popup-eyebrow">Достижение получено</p>
        <SpriteBadge achievement={achievement} settings={settings} />
        <h2>{achievement.title}</h2>
        <p>{achievement.description}</p>
        <button className="primary-button" type="button">Продолжить <Sparkles size={17} /></button>
        <i className="achievement-spark spark-1" /><i className="achievement-spark spark-2" /><i className="achievement-spark spark-3" />
      </section>
    </figure>
  )
}

function NumberSetting({
  label,
  value,
  suffix,
  min = 0,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  min?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="biome-setting">
      <span>{label}</span>
      <span className="biome-setting-input">
        <input type="number" value={value} min={min} step={step} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  )
}

function SettingsPanel({ settings, onChange, onReset }: {
  settings: SpriteSettings
  onChange: (key: keyof SpriteSettings, value: number) => void
  onReset: () => void
}) {
  const field = (key: keyof SpriteSettings) => (value: number) => onChange(key, value)
  return (
    <aside className="biome-settings-panel">
      <header>
        <div><span>Живые настройки</span><h2>Нарезка спрайта</h2></div>
        <button type="button" onClick={onReset} title="Вернуть текущие игровые значения"><RotateCcw size={17} /></button>
      </header>

      <fieldset>
        <legend>CSS</legend>
        <div className="biome-settings-grid">
          <NumberSetting label="width" value={settings.badgeWidth} suffix="px" min={1} onChange={field('badgeWidth')} />
          <NumberSetting label="height" value={settings.badgeHeight} suffix="px" min={1} onChange={field('badgeHeight')} />
          <NumberSetting label="background X" value={settings.backgroundWidth} suffix="%" min={1} onChange={field('backgroundWidth')} />
          <NumberSetting label="background Y" value={settings.backgroundHeight} suffix="%" min={1} onChange={field('backgroundHeight')} />
          <NumberSetting label="border-radius" value={settings.borderRadius} suffix="%" min={0} step={.5} onChange={field('borderRadius')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>JS</legend>
        <div className="biome-settings-grid">
          <NumberSetting label="columns" value={settings.columns} min={1} onChange={field('columns')} />
          <NumberSetting label="rows" value={settings.rows} min={1} onChange={field('rows')} />
          <NumberSetting label="X divisor" value={settings.xDivisor} min={1} step={.1} onChange={field('xDivisor')} />
          <NumberSetting label="Y divisor" value={settings.yDivisor} min={1} step={.1} onChange={field('yDivisor')} />
          <NumberSetting label="X offset" value={settings.offsetX} suffix="%" min={-500} step={.5} onChange={field('offsetX')} />
          <NumberSetting label="Y offset" value={settings.offsetY} suffix="%" min={-500} step={.5} onChange={field('offsetY')} />
        </div>
      </fieldset>

      <div className="biome-code-block">
        <b>CSS</b>
        <code>{`.badge {\n  width: ${settings.badgeWidth}px; height: ${settings.badgeHeight}px;\n  background-size: ${settings.backgroundWidth}% ${settings.backgroundHeight}%;\n  border-radius: ${settings.borderRadius}%;\n}`}</code>
      </div>
      <div className="biome-code-block">
        <b>JS</b>
        <code>{`column = index % ${settings.columns}\nrow = Math.floor(index / ${settings.columns})\nx = ${settings.offsetX} + column / ${settings.xDivisor} * 100\ny = ${settings.offsetY} + row / ${settings.yDivisor} * 100`}</code>
      </div>
      <p className="biome-settings-note">Игровые значения: 162×180 px, 500%×300%, сетка 5×3, делители 4 и 2.</p>
    </aside>
  )
}

function AtlasPanel({ settings }: { settings: SpriteSettings }) {
  const cells = Array.from({ length: settings.columns * settings.rows })
  return (
    <section className="biome-atlas-panel">
      <header><span>Исходник 1536 × 1024 px</span><b>{settings.columns} × {settings.rows}</b></header>
      <div className="biome-atlas-image">
        <img src={spriteUrl} alt="Атлас biome badges" />
        <div style={{ gridTemplateColumns: `repeat(${settings.columns}, 1fr)`, gridTemplateRows: `repeat(${settings.rows}, 1fr)` }}>
          {cells.map((_, index) => <span key={index}>{index}</span>)}
        </div>
      </div>
      <p>Условная ячейка исходника: {(1536 / settings.columns).toFixed(2)} × {(1024 / settings.rows).toFixed(2)} px</p>
    </section>
  )
}

function FormulaTable({ settings }: { settings: SpriteSettings }) {
  return (
    <section className="biome-formula-table">
      <header><span>index</span><span>column</span><span>row</span><span>background-position</span></header>
      {biomeAchievements.map((achievement) => {
        const metrics = spriteMetrics(achievement.badge.index, settings)
        return (
          <div key={achievement.id}>
            <b>{achievement.badge.index}</b>
            <span>{metrics.column}</span>
            <span>{metrics.row}</span>
            <code>{formatPercent(metrics.x)} {formatPercent(metrics.y)}</code>
          </div>
        )
      })}
    </section>
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
    <nav className="biome-variant-switcher" aria-label="Варианты отладочной страницы">
      <button type="button" onClick={() => cycle(-1)} aria-label="Предыдущий вариант"><ChevronLeft size={18} /></button>
      <span><b>{active.key}</b> — {active.name}</span>
      <button type="button" onClick={() => cycle(1)} aria-label="Следующий вариант"><ChevronRight size={18} /></button>
    </nav>
  )
}

export function BiomeBadgesPrototype() {
  const [variant, setVariant] = useState<Variant>(readVariant)
  const [settings, setSettings] = useState<SpriteSettings>(initialSettings)

  const changeVariant = useCallback((next: Variant) => {
    const search = new URLSearchParams(window.location.search)
    search.set('variant', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${search}`)
    setVariant(next)
  }, [])

  const changeSetting = useCallback((key: keyof SpriteSettings, value: number) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }, [])

  const popupGallery = useMemo(() => biomeAchievements.map((achievement) => (
    <PopupPreview achievement={achievement} settings={settings} key={achievement.id} />
  )), [settings])

  return (
    <main className={`biome-badges-prototype biome-badges-variant-${variant.toLowerCase()}`}>
      <header className="biome-prototype-title">
        <div><span>PROTOTYPE · DEV ONLY</span><h1>Biome badges</h1></div>
        <p>Меняйте параметры спрайта — все 15 табличек пересчитываются сразу. Настройки живут только в памяти страницы.</p>
      </header>

      {variant === 'A' && (
        <div className="biome-gallery-layout">
          <SettingsPanel settings={settings} onChange={changeSetting} onReset={() => setSettings(initialSettings)} />
          <section className="biome-popup-gallery">{popupGallery}</section>
        </div>
      )}

      {variant === 'B' && (
        <div className="biome-atlas-layout">
          <div className="biome-atlas-tools">
            <SettingsPanel settings={settings} onChange={changeSetting} onReset={() => setSettings(initialSettings)} />
            <AtlasPanel settings={settings} />
          </div>
          <section className="biome-popup-gallery biome-popup-strip">{popupGallery}</section>
        </div>
      )}

      {variant === 'C' && (
        <div className="biome-formula-layout">
          <div className="biome-formula-tools">
            <SettingsPanel settings={settings} onChange={changeSetting} onReset={() => setSettings(initialSettings)} />
            <FormulaTable settings={settings} />
          </div>
          <section className="biome-popup-gallery biome-popup-list">{popupGallery}</section>
        </div>
      )}

      <VariantSwitcher current={variant} onChange={changeVariant} />
    </main>
  )
}
