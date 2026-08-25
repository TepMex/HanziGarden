// PROTOTYPE — three views of every player-facing screen, switchable via ?variant=.
// The route is read-only: screens are static production-class mockups, and token
// tweaks stay in memory so a designer can watch every surface update at once.
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, BarChart3, BookOpen, ChevronLeft, ChevronRight, Flower2, Grid3X3, HandHeart, HelpCircle, Layers, Leaf, LogOut, Plus, RotateCcw, Sparkles, StickyNote, Trophy, X } from 'lucide-react'
import { AchievementCollection, AchievementPopup } from '../achievements/AchievementUi'
import { hanziWalkthroughs } from '../walkthrough'
import { WalkthroughDialog } from '../walkthrough/WalkthroughDialog'
import { assetUrl } from '../assetUrl'
import { battleArtworkForBiome } from '../data/battleBiomeArt'
import { biomes } from '../data/mapLayout'
import { characters } from '../data/model'
import { getLevelProgress, initialPlayerProgress, initialSessionProgress } from '../progression'
import { SRS_STAGES } from '../stats/srsStages'
import './screenSpreadPrototype.css'

type Variant = 'A' | 'B' | 'C'
type FramePreset = 'phone' | 'tablet' | 'desktop'

type Tokens = {
  paperLight: string
  paperDeep: string
  ink: string
  jadeLight: string
  jadeDeep: string
  gold: string
  seal: string
  chrome: string
  night: string
  nightMid: string
}

type FrameSize = { width: number; height: number; phone: boolean }

const variants: Array<{ key: Variant; name: string }> = [
  { key: 'A', name: 'Галерея' },
  { key: 'B', name: 'Маршрут' },
  { key: 'C', name: 'Аудит' },
]

const framePresets: Record<FramePreset, FrameSize> = {
  phone: { width: 390, height: 844, phone: true },
  tablet: { width: 768, height: 1024, phone: true },
  desktop: { width: 1280, height: 800, phone: false },
}

const initialTokens: Tokens = {
  paperLight: '#e4d6b3',
  paperDeep: '#d2c199',
  ink: '#3a3027',
  jadeLight: '#40574b',
  jadeDeep: '#273a31',
  gold: '#b99c62',
  seal: '#7d302b',
  chrome: '#f1e4c7',
  night: '#17231f',
  nightMid: '#34473d',
}

const screenCatalog = [
  { id: 'loading', title: 'Загрузка', group: 'Вход', classes: '.loading-screen', tokens: 'night, nightMid, chrome' },
  { id: 'menu', title: 'Главное меню', group: 'Вход', classes: '.welcome-screen .welcome-card .seal .primary-button .menu-button', tokens: 'paper, ink, jade, gold, seal' },
  { id: 'about', title: 'Об игре', group: 'Вход', classes: '.welcome-screen .menu-info-card', tokens: 'paper, ink, gold, seal' },
  { id: 'support', title: 'Поддержать', group: 'Вход', classes: '.welcome-screen .menu-info-card', tokens: 'paper, ink, gold, seal' },
  { id: 'garden', title: 'Карта сада', group: 'Сад', classes: '.map-screen .map-header .player-level .map-stats-button', tokens: 'night, chrome, gold, jade' },
  { id: 'battle', title: 'Бой', group: 'Письмо', classes: '.battle-screen .prompt-scroll .writing-circle .hint-button', tokens: 'paper, ink, chrome, gold' },
  { id: 'composition', title: 'Состав', group: 'Письмо', classes: '.composition-dialog .composition-list', tokens: 'paper, ink, gold, jade' },
  { id: 'note', title: 'Заметка', group: 'Письмо', classes: '.note-dialog .note-editor', tokens: 'paper, ink, gold, jade' },
  { id: 'walkthrough', title: 'Правило черт', group: 'Письмо', classes: '.walkthrough-dialog .walkthrough-demo .primary-button', tokens: 'paper, ink, gold, jade' },
  { id: 'cleared', title: 'Грядка очищена', group: 'Письмо', classes: '.cleared-state .xp-summary .primary-button', tokens: 'paper, ink, jade, gold' },
  { id: 'stats', title: 'Стена иероглифов', group: 'Летопись', classes: '.statistics-screen .character-wall .character-tile', tokens: 'night, chrome, gold, paper' },
  { id: 'achievements', title: 'Коллекция достижений', group: 'Летопись', classes: '.achievement-collection .achievement-card', tokens: 'night, chrome, paper, gold' },
  { id: 'popup', title: 'Достижение получено', group: 'Награды', classes: '.achievement-popup .achievement-badge .primary-button', tokens: 'paper, ink, seal, jade, gold' },
] as const

type ScreenId = (typeof screenCatalog)[number]['id']

const previewPlayer = { ...initialPlayerProgress, totalXp: 860, lifetimeCompletedKanji: 48, lifetimeCompletedBeds: 6 }
const previewSession = { ...initialSessionProgress, combo: 7, earnedXp: 124, completedBeds: 2 }
const previewAchievements = {
  unlockedAchievements: [
    { id: 'perfect_bed', unlockedAt: '2026-08-12T09:00:00.000Z' },
    { id: 'biomes_1', unlockedAt: '2026-08-18T16:40:00.000Z' },
    { id: 'completed_kanji_100', unlockedAt: '2026-08-20T11:15:00.000Z' },
  ],
  currentDailyStreak: 4,
  bestDailyStreak: 9,
  perfectBedsToday: { count: 1 },
}

function readVariant(): Variant {
  const variant = new URLSearchParams(window.location.search).get('variant')
  return variant === 'B' || variant === 'C' ? variant : 'A'
}

function readPreset(): FramePreset {
  const preset = new URLSearchParams(window.location.search).get('frame')
  return preset === 'tablet' || preset === 'desktop' ? preset : 'phone'
}

function PlayerLevel({ totalXp, compact = false }: { totalXp: number; compact?: boolean }) {
  const progress = getLevelProgress(totalXp)
  const percent = progress.xpNeededInsideLevel === 0 ? 0 : progress.xpInsideLevel / progress.xpNeededInsideLevel
  return (
    <div className={`player-level ${compact ? 'is-compact' : ''}`} aria-label={`Уровень ${progress.level}`}>
      <strong>{progress.level}</strong>
      <span className="player-level-track"><i style={{ width: `${percent * 100}%` }} /></span>
      <small>{progress.xpInsideLevel} / {progress.xpNeededInsideLevel} XP</small>
    </div>
  )
}

function noop() {}

function LoadingMock() {
  return <div className="loading-screen"><Leaf /> Заходим в сад…</div>
}

function MenuMock() {
  return (
    <div className="welcome-screen">
      <div className="welcome-vignette" />
      <section className="welcome-card">
        <div className="seal"><span>忆</span></div>
        <p className="eyebrow">Изучи китайскую письменность</p>
        <h1>Hanzi Garden</h1>
        <p>Добро пожаловать в Hanzi Garden! Очищай сад от сорняков, запоминай начертания иероглифов и тренируй механическую память!</p>
        <div className="welcome-rule"><span /> кисть поможет запомнить <span /></div>
        <nav className="main-menu" aria-label="Главное меню">
          <button className="primary-button" type="button">Войти в сад <Leaf size={18} /></button>
          <button className="menu-button" type="button">Об игре <BookOpen size={18} /></button>
          <button className="menu-button" type="button">Поддержать <HandHeart size={18} /></button>
          <button className="menu-button menu-exit-button" type="button">Выход <LogOut size={18} /></button>
        </nav>
      </section>
    </div>
  )
}

function InfoMock({ kind }: { kind: 'about' | 'support' }) {
  const about = kind === 'about'
  return (
    <div className="welcome-screen">
      <div className="welcome-vignette" />
      <section className="welcome-card menu-info-card">
        <div className="seal"><span>忆</span></div>
        <p className="eyebrow">Hanzi Garden</p>
        <h1>{about ? 'Об игре' : 'Поддержать'}</h1>
        <p>{about ? 'Здесь появится информация об игре.' : 'Здесь появится информация о способах поддержать проект.'}</p>
        <button className="menu-button" type="button"><ArrowLeft size={18} /> Вернуться в главное меню</button>
      </section>
    </div>
  )
}

function GardenMock() {
  return (
    <main className="map-screen">
      <header className="map-header">
        <div className="map-brand-progress">
          <div className="brand-mark"><Leaf size={18} /><span>Hanzi Garden</span></div>
          <PlayerLevel totalXp={previewPlayer.totalXp} compact />
        </div>
        <div className="garden-summary">
          <button type="button" className="map-grid-button" aria-label="Показать сетку"><Grid3X3 size={17} /></button>
          <button type="button" className="map-stats-button" aria-label="Статистика"><BarChart3 size={17} /><span>Статистика</span></button>
          <button type="button" className="map-menu-button" aria-label="Выйти в главное меню"><LogOut size={18} /></button>
        </div>
      </header>
      <div className="garden-map-viewport" aria-hidden="true">
        <img className="screen-spread-map-art" src={assetUrl('assets/garden-map.webp')} alt="" />
      </div>
    </main>
  )
}

function BattleShell({
  children,
  backdrop,
  primitive,
}: {
  children?: ReactNode
  backdrop: string
  primitive?: string | null
}) {
  return (
    <main className={`battle-screen ${primitive ? 'has-primitive' : ''}`}>
      <div className="battle-backdrop" style={{ backgroundImage: `url(${JSON.stringify(backdrop)})` }} aria-hidden="true" />
      <button className="back-button" type="button" aria-label="Вернуться в сад"><ArrowLeft /></button>
      {children}
    </main>
  )
}

function BattleWritingMock({
  backdrop,
  keyword,
  primitive,
  hanzi,
  toast = false,
}: {
  backdrop: string
  keyword: string
  primitive: string | null
  hanzi: string
  toast?: boolean
}) {
  return (
    <BattleShell backdrop={backdrop} primitive={primitive}>
      <header className="prompt-scroll">
        <strong>{keyword.toLocaleUpperCase('ru')}</strong>
        {primitive && (
          <p className="primitive-prompt">
            <Plus size={13} aria-hidden="true" />
            <b>{primitive}</b>
          </p>
        )}
      </header>
      <div className="battle-assist-buttons">
        <button className="composition-button" type="button" aria-label="Показать состав иероглифа">
          <Layers size={18} /> <span>Состав</span>
        </button>
        <button className="note-button has-note" type="button" aria-label="Открыть заметку">
          <StickyNote size={18} /> <span>Заметка</span>
        </button>
      </div>
      <div className="writing-circle">
        <div className="writing-target" aria-hidden="true"><span>{hanzi}</span></div>
      </div>
      <button className="hint-button" type="button"><HelpCircle size={16} /> Показать следующий штрих</button>
      <div className="bed-cleanliness" title="Здоровье грядки">
        <Leaf size={15} /><span><i style={{ width: '42%' }} /></span>
      </div>
      {toast && (
        <div className="xp-toast has-milestone">
          <strong>+5 XP</strong>
          <span>COMBO ×7</span>
          <small>+3 XP</small>
        </div>
      )}
    </BattleShell>
  )
}

function BattleCompositionMock({
  backdrop,
  keyword,
  primitive,
  hanzi,
  components,
}: {
  backdrop: string
  keyword: string
  primitive: string | null
  hanzi: string
  components: ReadonlyArray<{ hanzi: string; keyword: string }>
}) {
  return (
    <BattleShell backdrop={backdrop} primitive={primitive}>
      <header className="prompt-scroll">
        <strong>{keyword.toLocaleUpperCase('ru')}</strong>
        {primitive && (
          <p className="primitive-prompt">
            <Plus size={13} aria-hidden="true" />
            <b>{primitive}</b>
          </p>
        )}
      </header>
      <div className="writing-circle">
        <div className="writing-target" aria-hidden="true"><span>{hanzi}</span></div>
      </div>
      <div className="composition-backdrop">
        <section className="composition-dialog" role="dialog" aria-labelledby="spread-composition-title">
          <button className="composition-close" type="button" aria-label="Закрыть состав"><X /></button>
          <p className="composition-eyebrow">Состав иероглифа</p>
          <h1 id="spread-composition-title">{keyword}</h1>
          <ol className="composition-list">
            {components.map((component, index) => (
              <li key={`${component.hanzi}:${index}`}>
                <span className="component-hanzi">{component.hanzi}</span>
                <span>{component.keyword}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </BattleShell>
  )
}

function BattleNoteMock({
  backdrop,
  keyword,
  primitive,
  hanzi,
}: {
  backdrop: string
  keyword: string
  primitive: string | null
  hanzi: string
}) {
  return (
    <BattleShell backdrop={backdrop} primitive={primitive}>
      <header className="prompt-scroll">
        <strong>{keyword.toLocaleUpperCase('ru')}</strong>
        {primitive && (
          <p className="primitive-prompt">
            <Plus size={13} aria-hidden="true" />
            <b>{primitive}</b>
          </p>
        )}
      </header>
      <div className="writing-circle">
        <div className="writing-target" aria-hidden="true"><span>{hanzi}</span></div>
      </div>
      <div className="composition-backdrop">
        <section className="composition-dialog note-dialog" role="dialog" aria-labelledby="spread-note-title">
          <button className="composition-close" type="button" aria-label="Закрыть заметку"><X /></button>
          <p className="composition-eyebrow">Заметка</p>
          <h1 id="spread-note-title">{keyword}</h1>
          <textarea
            className="note-editor"
            readOnly
            value="огонь сверху, вода слева"
            aria-label="Текст заметки"
          />
          <button className="primary-button note-save" type="button">Сохранить</button>
        </section>
      </div>
    </BattleShell>
  )
}

function BattleClearedMock({ backdrop }: { backdrop: string }) {
  return (
    <BattleShell backdrop={backdrop}>
      <header className="prompt-scroll">
        <strong>ГРЯДКА ОЧИЩЕНА</strong>
      </header>
      <section className="cleared-state">
        <Flower2 />
        <p className="cleared-eyebrow">Грядка очищена</p>
        <h1>Сад снова дышит</h1>
        <p>Все сорняки на этой грядке уничтожены. Новые повторения появятся здесь по расписанию памяти.</p>
        <div className="xp-summary">
          <span>Правильные штрихи <b>+18 XP</b></span>
          <span>Ошибки <b className="is-negative">−2 XP</b></span>
          <span>Комбо <b>+6 XP</b></span>
          <strong>Итого <b>+22 XP</b></strong>
          <PlayerLevel totalXp={previewPlayer.totalXp} />
          <div className="level-up-beat"><Trophy size={18} /> Новый уровень 4</div>
        </div>
        <button className="primary-button is-ready" type="button">Вернуться в сад <Sparkles size={17} /></button>
      </section>
    </BattleShell>
  )
}

function StatsMemoryMock() {
  const tiles = characters.slice(0, 96)
  return (
    <main className="statistics-screen">
      <header className="statistics-header">
        <button className="stats-back" type="button"><ArrowLeft size={18} /> К карте</button>
        <div className="brand-mark"><Leaf size={18} /><span>Hanzi Garden</span></div>
      </header>
      <section className="statistics-content">
        <p className="eyebrow">Летопись сада</p>
        <h1>Стена иероглифов</h1>
        <div className="statistics-tabs" role="tablist" aria-label="Раздел статистики">
          <button type="button" role="tab" aria-selected>Память</button>
          <button type="button" role="tab" aria-selected={false}>Достижения</button>
        </div>
        <div className="statistics-totals">
          <span>Изучено: <strong>48 / {characters.length}</strong></span>
          <span>Закреплено: <strong>11</strong></span>
        </div>
        <div className="srs-legend" aria-label="Легенда стадий SRS">
          {SRS_STAGES.map((stage) => (
            <span className="srs-legend-item" key={stage.id}>
              <i style={{ backgroundColor: stage.color }} /> {stage.label} <b>{stage.id === 'new' ? 12 : 4}</b>
            </span>
          ))}
        </div>
        <aside className="character-detail">
          <strong>{tiles[10]?.hanzi ?? '明'}</strong>
          <span>{tiles[10]?.keyword.ru ?? 'яркий'} · кадр {tiles[10]?.frame ?? 19}</span>
          <span>Ученик · повтор: 24 авг. 2026 г.</span>
        </aside>
        <div className="character-wall" aria-hidden="true">
          {tiles.map((character, index) => (
            <button
              className="character-tile"
              type="button"
              style={{ backgroundColor: SRS_STAGES[index % SRS_STAGES.length]!.color }}
              key={character.id}
            >
              {character.hanzi}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function StatsAchievementsMock() {
  return (
    <main className="statistics-screen">
      <header className="statistics-header">
        <button className="stats-back" type="button"><ArrowLeft size={18} /> К карте</button>
        <div className="brand-mark"><Leaf size={18} /><span>Hanzi Garden</span></div>
      </header>
      <section className="statistics-content">
        <p className="eyebrow">Летопись сада</p>
        <h1>Достижения</h1>
        <div className="statistics-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={false}>Память</button>
          <button type="button" role="tab" aria-selected>Достижения</button>
        </div>
        <AchievementCollection persistence={previewAchievements} player={previewPlayer} session={previewSession} />
      </section>
    </main>
  )
}

function BattleWalkthroughMock({ backdrop }: { backdrop: string }) {
  const walkthrough = hanziWalkthroughs['二']![0]!
  return (
    <BattleShell backdrop={backdrop}>
      <header className="prompt-scroll">
        <strong>ДВА</strong>
      </header>
      <div className="writing-circle">
        <div className="writing-target" aria-hidden="true"><span>二</span></div>
      </div>
      <WalkthroughDialog
        walkthrough={walkthrough}
        demo={<div className="walkthrough-demo"><span className="walkthrough-demo-glyph">二</span></div>}
        onContinue={noop}
      />
    </BattleShell>
  )
}

function AchievementPopupMock({ backdrop, keyword, hanzi }: { backdrop: string; keyword: string; hanzi: string }) {
  return (
    <BattleShell backdrop={backdrop}>
      <header className="prompt-scroll">
        <strong>{keyword.toLocaleUpperCase('ru')}</strong>
      </header>
      <div className="writing-circle">
        <div className="writing-target" aria-hidden="true"><span>{hanzi}</span></div>
      </div>
      <AchievementPopup achievementId="perfect_bed" onClose={noop} />
    </BattleShell>
  )
}

function ColorSetting({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="spread-setting">
      <span>{label}</span>
      <span className="spread-setting-input">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
      </span>
    </label>
  )
}

function tokenCss(tokens: Tokens): string {
  return `.screen-spread-prototype {
  --spread-paper-light: ${tokens.paperLight};
  --spread-paper-deep: ${tokens.paperDeep};
  --spread-ink: ${tokens.ink};
  --spread-jade-light: ${tokens.jadeLight};
  --spread-jade-deep: ${tokens.jadeDeep};
  --spread-gold: ${tokens.gold};
  --spread-seal: ${tokens.seal};
  --spread-chrome: ${tokens.chrome};
  --spread-night: ${tokens.night};
  --spread-night-mid: ${tokens.nightMid};
}

.screen-spread-prototype .welcome-card,
.screen-spread-prototype .menu-info-card,
.screen-spread-prototype .prompt-scroll,
.screen-spread-prototype .cleared-state,
.screen-spread-prototype .composition-dialog,
.screen-spread-prototype .note-dialog,
.screen-spread-prototype .walkthrough-dialog,
.screen-spread-prototype .achievement-popup,
.screen-spread-prototype .character-detail {
  color: var(--spread-ink);
}

.screen-spread-prototype .welcome-card {
  background:
    linear-gradient(color-mix(in srgb, var(--spread-paper-light) 90%, transparent), color-mix(in srgb, var(--spread-paper-deep) 94%, transparent)),
    repeating-linear-gradient(4deg, transparent 0 4px, rgba(68, 58, 42, .05) 5px 6px);
  border-color: color-mix(in srgb, var(--spread-gold) 70%, white);
}

.screen-spread-prototype .prompt-scroll {
  background: linear-gradient(color-mix(in srgb, var(--spread-paper-light) 97%, white), color-mix(in srgb, var(--spread-paper-deep) 95%, white));
  border-color: color-mix(in srgb, var(--spread-gold) 68%, #684e2e);
}

.screen-spread-prototype .cleared-state {
  background: color-mix(in srgb, var(--spread-paper-light) 86%, transparent);
  border-color: color-mix(in srgb, var(--spread-gold) 80%, white);
}

.screen-spread-prototype .composition-dialog,
.screen-spread-prototype .note-dialog,
.screen-spread-prototype .walkthrough-dialog,
.screen-spread-prototype .achievement-popup {
  background: linear-gradient(145deg, var(--spread-paper-light), var(--spread-paper-deep));
  border-color: var(--spread-gold);
}

.screen-spread-prototype .character-detail { background: var(--spread-paper-light); }

.screen-spread-prototype .seal,
.screen-spread-prototype .achievement-seal { background: var(--spread-seal); }

.screen-spread-prototype .primary-button,
.screen-spread-prototype .map-loading-screen button {
  color: var(--spread-chrome);
  border-color: var(--spread-gold);
  background: linear-gradient(var(--spread-jade-light), var(--spread-jade-deep));
}

.screen-spread-prototype .menu-button { color: var(--spread-ink); }

.screen-spread-prototype .map-grid-button,
.screen-spread-prototype .map-menu-button,
.screen-spread-prototype .map-stats-button,
.screen-spread-prototype .stats-back,
.screen-spread-prototype .back-button,
.screen-spread-prototype .composition-button,
.screen-spread-prototype .note-button,
.screen-spread-prototype .hint-button,
.screen-spread-prototype .bed-cleanliness {
  color: var(--spread-chrome);
  border-color: color-mix(in srgb, var(--spread-gold) 55%, transparent);
}

.screen-spread-prototype .loading-screen {
  color: var(--spread-chrome);
  background: radial-gradient(circle, var(--spread-night-mid), var(--spread-night) 68%);
}

.screen-spread-prototype .map-screen { background: var(--spread-night); }
.screen-spread-prototype .statistics-screen {
  color: var(--spread-chrome);
  background: radial-gradient(ellipse at 50% 0, var(--spread-night-mid), var(--spread-night) 62%);
}

.screen-spread-prototype .statistics-tabs button[aria-selected="true"] {
  color: var(--spread-ink);
  border-color: var(--spread-gold);
  background: linear-gradient(var(--spread-paper-light), var(--spread-paper-deep));
}

.screen-spread-prototype .player-level > strong {
  border-color: var(--spread-gold);
  background: radial-gradient(circle, var(--spread-paper-light), var(--spread-gold));
}`
}

function SettingsPanel({
  tokens,
  preset,
  scale,
  onToken,
  onPreset,
  onScale,
  onReset,
}: {
  tokens: Tokens
  preset: FramePreset
  scale: number
  onToken: (key: keyof Tokens, value: string) => void
  onPreset: (preset: FramePreset) => void
  onScale: (scale: number) => void
  onReset: () => void
}) {
  return (
    <aside className="spread-settings">
      <header>
        <div><span>Живые настройки</span><h2>Дизайн всех экранов</h2></div>
        <button type="button" onClick={onReset} title="Вернуть игровые значения"><RotateCcw size={17} /></button>
      </header>

      <fieldset>
        <legend>Рамка</legend>
        <div className="spread-preset-row">
          {(['phone', 'tablet', 'desktop'] as const).map((item) => (
            <button type="button" className={preset === item ? 'is-active' : ''} onClick={() => onPreset(item)} key={item}>
              {item === 'phone' ? 'Телефон' : item === 'tablet' ? 'Планшет' : 'Десктоп'}
            </button>
          ))}
        </div>
        <label className="spread-setting">
          <span>Масштаб {Math.round(scale * 100)}%</span>
          <input type="range" min={0.35} max={1} step={0.05} value={scale} onChange={(event) => onScale(Number(event.target.value))} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Пергамент</legend>
        <div className="spread-settings-grid">
          <ColorSetting label="светлый" value={tokens.paperLight} onChange={(value) => onToken('paperLight', value)} />
          <ColorSetting label="тёмный" value={tokens.paperDeep} onChange={(value) => onToken('paperDeep', value)} />
          <ColorSetting label="чернила" value={tokens.ink} onChange={(value) => onToken('ink', value)} />
          <ColorSetting label="печать" value={tokens.seal} onChange={(value) => onToken('seal', value)} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Нефрит и золото</legend>
        <div className="spread-settings-grid">
          <ColorSetting label="нефрит светлый" value={tokens.jadeLight} onChange={(value) => onToken('jadeLight', value)} />
          <ColorSetting label="нефрит тёмный" value={tokens.jadeDeep} onChange={(value) => onToken('jadeDeep', value)} />
          <ColorSetting label="золото" value={tokens.gold} onChange={(value) => onToken('gold', value)} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Ночь</legend>
        <div className="spread-settings-grid">
          <ColorSetting label="хром" value={tokens.chrome} onChange={(value) => onToken('chrome', value)} />
          <ColorSetting label="ночь" value={tokens.night} onChange={(value) => onToken('night', value)} />
          <ColorSetting label="сумерки" value={tokens.nightMid} onChange={(value) => onToken('nightMid', value)} />
        </div>
      </fieldset>

      <div className="spread-css-block">
        <b>Переопределения</b>
        <code>{tokenCss(tokens)}</code>
      </div>
      <p className="spread-settings-note">Макеты собраны из продакшен-классов. Панель перекрывает общие цвета на всех экранах сразу. Сброс возвращает игровые значения. Правки `styles.css` видны для свойств, которые панель не трогает.</p>
    </aside>
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
    <nav className="spread-variant-switcher" aria-label="Варианты отладочной страницы">
      <button type="button" onClick={() => cycle(-1)} aria-label="Предыдущий вариант"><ChevronLeft size={18} /></button>
      <span><b>{active.key}</b> — {active.name}</span>
      <button type="button" onClick={() => cycle(1)} aria-label="Следующий вариант"><ChevronRight size={18} /></button>
    </nav>
  )
}

function ScreenFrame({
  screen,
  size,
  scale,
  caption,
  note,
}: {
  screen: ReactNode
  size: FrameSize
  scale: number
  caption: string
  note?: string
}) {
  return (
    <figure className="spread-card">
      <figcaption>
        <b>{caption}</b>
        {note && <small>{note}</small>}
      </figcaption>
      <div className="spread-scale" style={{ width: size.width * scale, height: size.height * scale }}>
        <div
          className={`screen-frame ${size.phone ? 'is-phone' : ''}`}
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
        >
          {screen}
        </div>
      </div>
    </figure>
  )
}

export function ScreenSpreadPrototype() {
  const [variant, setVariant] = useState<Variant>(readVariant)
  const [preset, setPreset] = useState<FramePreset>(readPreset)
  const [scale, setScale] = useState(0.55)
  const [tokens, setTokens] = useState<Tokens>(initialTokens)

  const sample = useMemo(
    () => characters.find((character) => character.structure.primitive && character.structure.components.length >= 2) ?? characters[0]!,
    [],
  )
  const backdrop = useMemo(
    () => assetUrl(battleArtworkForBiome(biomes[0]!.id).backgrounds.halfDirty),
    [],
  )
  const cleanBackdrop = useMemo(
    () => assetUrl(battleArtworkForBiome(biomes[0]!.id).backgrounds.clean),
    [],
  )
  const size = framePresets[preset]

  const screens = useMemo<Record<ScreenId, ReactNode>>(() => ({
    loading: <LoadingMock />,
    menu: <MenuMock />,
    about: <InfoMock kind="about" />,
    support: <InfoMock kind="support" />,
    garden: <GardenMock />,
    battle: <BattleWritingMock backdrop={backdrop} keyword={sample.keyword.ru} primitive={sample.structure.primitive} hanzi={sample.hanzi} toast />,
    composition: <BattleCompositionMock backdrop={backdrop} keyword={sample.keyword.ru} primitive={sample.structure.primitive} hanzi={sample.hanzi} components={sample.structure.components} />,
    note: <BattleNoteMock backdrop={backdrop} keyword={sample.keyword.ru} primitive={sample.structure.primitive} hanzi={sample.hanzi} />,
    walkthrough: <BattleWalkthroughMock backdrop={backdrop} />,
    cleared: <BattleClearedMock backdrop={cleanBackdrop} />,
    stats: <StatsMemoryMock />,
    achievements: <StatsAchievementsMock />,
    popup: <AchievementPopupMock backdrop={backdrop} keyword={sample.keyword.ru} hanzi={sample.hanzi} />,
  }), [backdrop, cleanBackdrop, sample])

  const changeVariant = useCallback((next: Variant) => {
    const search = new URLSearchParams(window.location.search)
    search.set('variant', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${search}`)
    setVariant(next)
  }, [])

  const changePreset = useCallback((next: FramePreset) => {
    const search = new URLSearchParams(window.location.search)
    search.set('variant', variant)
    search.set('frame', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${search}`)
    setPreset(next)
    setScale(next === 'desktop' ? 0.4 : next === 'tablet' ? 0.45 : 0.55)
  }, [variant])

  const changeToken = useCallback((key: keyof Tokens, value: string) => {
    setTokens((current) => ({ ...current, [key]: value }))
  }, [])

  const cards = screenCatalog.map((item) => (
    <ScreenFrame
      screen={screens[item.id]}
      size={size}
      scale={scale}
      caption={item.title}
      note={variant === 'C' ? `${item.classes} · ${item.tokens}` : item.group}
      key={item.id}
    />
  ))

  const prototypeStyle = {
    '--spread-frame-width': `${size.width}px`,
    '--spread-frame-height': `${size.height}px`,
  } as CSSProperties

  return (
    <main className={`screen-spread-prototype screen-spread-variant-${variant.toLowerCase()}`} style={prototypeStyle}>
      <style>{tokenCss(tokens)}</style>
      <header className="spread-title">
        <div>
          <span>PROTOTYPE · DEV ONLY</span>
          <h1>Развёртка экранов</h1>
        </div>
        <p>
          Все {screenCatalog.length} поверхностей игрока в одном месте. Меняйте пергамент, нефрит и ночь —
          карточки, кнопки и хром перекрашиваются сразу на меню, карте, бое, статистике и наградах.
        </p>
      </header>

      {variant === 'A' && (
        <div className="spread-gallery-layout">
          <SettingsPanel tokens={tokens} preset={preset} scale={scale} onToken={changeToken} onPreset={changePreset} onScale={setScale} onReset={() => setTokens(initialTokens)} />
          <section className="spread-gallery">{cards}</section>
        </div>
      )}

      {variant === 'B' && (
        <div className="spread-journey-layout">
          <SettingsPanel tokens={tokens} preset={preset} scale={scale} onToken={changeToken} onPreset={changePreset} onScale={setScale} onReset={() => setTokens(initialTokens)} />
          <section className="spread-journey" aria-label="Маршрут игрока">
            {screenCatalog.map((item, index) => (
              <div className="spread-journey-step" key={item.id}>
                <span><b>{String(index + 1).padStart(2, '0')}</b> {item.group}</span>
                <ScreenFrame screen={screens[item.id]} size={size} scale={scale} caption={item.title} note={item.group} />
              </div>
            ))}
          </section>
        </div>
      )}

      {variant === 'C' && (
        <div className="spread-audit-layout">
          <section className="spread-audit-list">
            {screenCatalog.map((item) => (
              <article className="spread-audit-row" key={item.id}>
                <header>
                  <b>{item.title}</b>
                  <span>{item.group}</span>
                  <code>{item.classes}</code>
                  <small>{item.tokens}</small>
                </header>
                <ScreenFrame screen={screens[item.id]} size={size} scale={Math.min(scale, 0.5)} caption={item.title} />
              </article>
            ))}
          </section>
          <SettingsPanel tokens={tokens} preset={preset} scale={scale} onToken={changeToken} onPreset={changePreset} onScale={setScale} onReset={() => setTokens(initialTokens)} />
        </div>
      )}

      <dl className="spread-state">
        <div><dt>вариант</dt><dd>{variant}</dd></div>
        <div><dt>рамка</dt><dd>{preset} {size.width}×{size.height}</dd></div>
        <div><dt>масштаб</dt><dd>{Math.round(scale * 100)}%</dd></div>
        <div><dt>экраны</dt><dd>{screenCatalog.length}</dd></div>
        <div><dt>печать</dt><dd>{tokens.seal}</dd></div>
        <div><dt>нефрит</dt><dd>{tokens.jadeDeep}</dd></div>
      </dl>

      <VariantSwitcher current={variant} onChange={changeVariant} />
    </main>
  )
}
