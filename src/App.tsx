import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'
import { ArrowLeft, BarChart3, BookOpen, Flower2, Grid3X3, HandHeart, HelpCircle, Layers, Leaf, LogOut, Plus, Sparkles, Trophy, X } from 'lucide-react'
import { type BedDefinition, type CharacterDefinition } from './data/model'
import { battleArtworkForBiome, battleBackdropStage } from './data/battleBiomeArt'
import { initialSave, loadSave, persistSave, type SaveGame } from './db'
import { battleBedCleanliness, bedInfection } from './garden'
import { loadHanziCharData } from './hanziData'
import { isCardDue, reviewCard, type ReviewEvent } from './learning'
import { GardenMap } from './map/GardenMap'
import { initialCamera, type CameraState } from './map/cameraMath'
import { StatisticsScreen } from './stats/StatisticsScreen'
import { streakHighlightColor, streakHighlightOpacity, streakIntensity } from './streak'
import { assetUrl } from './assetUrl'
import { writingInkForBackdrop } from './battleInk'
import { dispatchQuizStroke, installGameCheats, registerBattleCheatDriver } from './gameCheats'
import {
  completedBiomeIds as findCompletedBiomeIds,
  processAchievementEvents,
  SESSION_IDLE_TIMEOUT_MS,
  type AchievementEvent,
} from './achievements'
import { AchievementPopup } from './achievements/AchievementUi'
import { playComboMilestoneCue } from './comboSound'
import {
  advanceActiveSession,
  completeBed,
  completeKanji,
  crossedLevels,
  getLevelProgress,
  initialSessionProgress,
  type KanjiReward,
  type SessionProgress,
} from './progression'

type Screen = 'menu' | 'about' | 'support' | 'garden' | 'battle' | 'stats'

type PendingCheatStroke = {
  expected: 'correct' | 'wrong'
  resolve: () => void
  reject: (error: Error) => void
  timeoutId: number
}

const NORMAL_HINT_COLOR = '#6d5269'
const STREAK_GRADIENT_ID = 'streak-jade-highlight'

function PlayerLevel({ totalXp, compact = false }: { totalXp: number; compact?: boolean }) {
  const progress = getLevelProgress(totalXp)
  const percent = progress.xpNeededInsideLevel === 0 ? 0 : progress.xpInsideLevel / progress.xpNeededInsideLevel
  return (
    <div className={`player-level ${compact ? 'is-compact' : ''}`} aria-label={`Уровень ${progress.level}, ${progress.xpInsideLevel} из ${progress.xpNeededInsideLevel} опыта`}>
      <strong>{progress.level}</strong>
      <span className="player-level-track"><i style={{ width: `${percent * 100}%` }} /></span>
      <small>{progress.xpInsideLevel} / {progress.xpNeededInsideLevel} XP</small>
    </div>
  )
}

function setStreakGradient(target: HTMLDivElement, intensity: number): () => void {
  const svg = target.querySelector('svg')
  const highlightGroup = svg?.querySelectorAll(':scope > g > g')[2] as SVGGElement | undefined
  const defs = svg?.querySelector(':scope > defs')
  if (!svg || !highlightGroup || !defs) return () => {}

  let gradient = defs.querySelector(`#${STREAK_GRADIENT_ID}`) as SVGLinearGradientElement | null
  if (!gradient) {
    gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
    gradient.id = STREAK_GRADIENT_ID
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse')
    gradient.setAttribute('x1', '90')
    gradient.setAttribute('y1', '260')
    gradient.setAttribute('x2', '910')
    gradient.setAttribute('y2', '520')
    defs.appendChild(gradient)
  }

  const progress = (intensity - 1) / 9
  const mutedJade = [
    [157, 179, 165], [145, 172, 153], [128, 160, 139], [144, 150, 112], [113, 142, 124],
  ]
  const deepJade = [
    [12, 58, 50], [17, 90, 74], [26, 119, 92], [37, 102, 76], [10, 63, 53],
  ]
  const mix = (from: number, to: number) => Math.round(from + (to - from) * progress)
  const stops = ['0%', '31%', '58%', '78%', '100%'].map((offset, index) => [
    offset,
    `rgb(${mix(mutedJade[index]![0], deepJade[index]![0])}, ${mix(mutedJade[index]![1], deepJade[index]![1])}, ${mix(mutedJade[index]![2], deepJade[index]![2])})`,
  ])
  gradient.replaceChildren(...stops.map(([offset, color]) => {
    const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop.setAttribute('offset', offset)
    stop.setAttribute('stop-color', color)
    return stop
  }))

  highlightGroup.classList.add('streak-highlight')
  highlightGroup.style.setProperty('--streak-ink-opacity', String(streakHighlightOpacity(intensity)))
  return () => {
    highlightGroup.classList.remove('streak-highlight')
    highlightGroup.style.removeProperty('--streak-ink-opacity')
  }
}

function getInputDevice(): ReviewEvent['inputDevice'] {
  if (navigator.maxTouchPoints > 0) return 'touch'
  return 'mouse'
}

function GardenScreen({
  save,
  camera,
  onCameraChange,
  onEnter,
  onMainMenu,
  onStatistics,
}: {
  save: SaveGame
  camera: CameraState
  onCameraChange: (camera: CameraState) => void
  onEnter: (bed: BedDefinition) => void
  onMainMenu: () => void
  onStatistics: () => void
}) {
  const [gridVisible, setGridVisible] = useState(false)
  return (
    <main className="map-screen">
      <header className="map-header">
        <div className="map-brand-progress">
          <div className="brand-mark"><Leaf size={18} /><span>Сад иероглифов</span></div>
          <PlayerLevel totalXp={save.playerProgress.totalXp} compact />
        </div>
        <div className="garden-summary">
          <button
            type="button"
            className="map-grid-button"
            aria-pressed={gridVisible}
            aria-label={gridVisible ? 'Скрыть сетку' : 'Показать сетку'}
            onClick={() => setGridVisible((visible) => !visible)}
          >
            <Grid3X3 size={17} />
          </button>
          <button className="map-stats-button" onClick={onStatistics} aria-label="Статистика"><BarChart3 size={17} /><span>Статистика</span></button>
          <button className="map-menu-button" onClick={onMainMenu} aria-label="Выйти в главное меню" title="Выйти в главное меню"><LogOut size={18} /></button>
        </div>
      </header>
      <GardenMap
        save={save}
        camera={camera}
        focusBedId={save.lastActiveBedId ?? save.unlockedBedIds[0] ?? null}
        gridVisible={gridVisible}
        onCameraChange={onCameraChange}
        onEnterBed={onEnter}
      />
    </main>
  )
}

function BattleScreen({
  bed,
  save,
  session,
  onSave,
  onExit,
}: {
  bed: BedDefinition
  save: SaveGame
  session: SessionProgress
  onSave: (save: SaveGame, session: SessionProgress, events: AchievementEvent[]) => void
  onExit: () => void
}) {
  const dueCharacters = useMemo(
    () => bed.characters.filter((character) => isCardDue(save.cards[character.id])),
    [bed, save],
  )
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(dueCharacters[0]?.id ?? null)
  const activeCharacter = bed.characters.find((character) => character.id === activeCharacterId) ?? null
  const writerTarget = useRef<HTMLDivElement>(null)
  const promptTextRef = useRef<HTMLElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const saveRef = useRef(save)
  const sessionRef = useRef(session)
  const bedStartXpRef = useRef(save.playerProgress.totalXp)
  const mistakesRef = useRef(0)
  const hintMistakesRef = useRef(0)
  const hintUsedRef = useRef(false)
  const startedAtRef = useRef(Date.now())
  const completingRef = useRef(false)
  const correctStrokesRef = useRef(0)
  const finalStrokeErrorRef = useRef(false)
  const streakHighlightRef = useRef(0)
  const clearStreakGradientRef = useRef<(() => void) | null>(null)
  const pendingCheatStrokeRef = useRef<PendingCheatStroke | null>(null)
  const [correctStrokes, setCorrectStrokes] = useState(0)
  const [isCompositionOpen, setCompositionOpen] = useState(false)
  const [lastReward, setLastReward] = useState<KanjiReward | null>(null)
  const [rewardSequence, setRewardSequence] = useState(0)
  const [bedSummary, setBedSummary] = useState({ correctStrokes: 0, errors: 0, comboBonusXp: 0, earnedXp: 0 })
  const bedSummaryRef = useRef(bedSummary)
  const [summaryReady, setSummaryReady] = useState(false)

  const settleCheatStroke = useCallback((outcome: 'correct' | 'wrong') => {
    const pending = pendingCheatStrokeRef.current
    if (!pending) return
    pendingCheatStrokeRef.current = null
    window.clearTimeout(pending.timeoutId)
    if (pending.expected === outcome) {
      pending.resolve()
    } else {
      pending.reject(new Error(`Ожидался ${pending.expected === 'correct' ? 'правильный' : 'неправильный'} чит-штрих, получен ${outcome}`))
    }
  }, [])

  const rejectPendingCheatStroke = useCallback((message: string) => {
    const pending = pendingCheatStrokeRef.current
    if (!pending) return
    pendingCheatStrokeRef.current = null
    window.clearTimeout(pending.timeoutId)
    pending.reject(new Error(message))
  }, [])

  useLayoutEffect(() => {
    const prompt = promptTextRef.current
    if (!prompt) return
    const scroll = prompt.closest('.prompt-scroll')
    const writer = document.querySelector('.writing-circle')

    const fit = () => {
      // Start from the responsive CSS maximum on every run.  The prior inline
      // size may have been selected for a narrower viewport or another word.
      prompt.style.fontSize = ''
      const maximum = Number.parseFloat(getComputedStyle(prompt).fontSize)
      const minimum = 16
      let chosen = minimum

      for (let size = maximum; size >= minimum; size -= 0.5) {
        prompt.style.fontSize = `${size}px`
        const style = getComputedStyle(prompt)
        const lineHeight = Number.parseFloat(style.lineHeight)
        const lines = Math.ceil(prompt.getBoundingClientRect().height / lineHeight - 0.01)
        const scrollRect = scroll?.getBoundingClientRect()
        const writerRect = writer?.getBoundingClientRect()
        const overlapsWriter = Boolean(scrollRect && writerRect && !(
          scrollRect.right <= writerRect.left || scrollRect.left >= writerRect.right ||
          scrollRect.bottom <= writerRect.top || scrollRect.top >= writerRect.bottom
        ))
        if (lines <= 3 && prompt.scrollWidth <= prompt.clientWidth + 0.5 && !overlapsWriter) {
          chosen = size
          break
        }
      }
      prompt.style.fontSize = `${chosen}px`
    }

    const frame = window.requestAnimationFrame(fit)
    window.addEventListener('resize', fit)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', fit)
    }
  }, [activeCharacter?.id])

  useEffect(() => { saveRef.current = save }, [save])
  useEffect(() => { sessionRef.current = session }, [session])

  const gainedLevels = crossedLevels(bedStartXpRef.current, save.playerProgress.totalXp)
  useEffect(() => {
    if (activeCharacter || bedSummary.earnedXp === 0) return
    setSummaryReady(false)
    const timeout = window.setTimeout(() => setSummaryReady(true), 900 + gainedLevels.length * 650)
    return () => window.clearTimeout(timeout)
  }, [activeCharacter, bedSummary.earnedXp, gainedLevels.length])

  useEffect(() => {
    setCompositionOpen(false)
  }, [activeCharacter?.id])

  useEffect(() => {
    if (!isCompositionOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCompositionOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isCompositionOpen])

  const finishCharacter = useCallback((character: CharacterDefinition, totalMistakes: number) => {
    if (completingRef.current) return
    completingRef.current = true
    const current = saveRef.current
    const progression = completeKanji(current.playerProgress, sessionRef.current, {
      correctStrokeCount: character.strokeCount,
      errorCount: totalMistakes,
      strokeCount: character.strokeCount,
    })
    const result = reviewCard(current.cards[character.id], totalMistakes, hintUsedRef.current)
    const seen = new Set(current.seenCharacterIds)
    seen.add(character.id)
    const mastered = new Set(current.masteredBedIds)
    const unlocked = new Set(current.unlockedBedIds)
    const bedMastered = bed.characterIds.every((id) => seen.has(id))
    if (bedMastered) {
      mastered.add(bed.id)
      bed.neighbors.forEach((id) => unlocked.add(id))
    }
    const event: ReviewEvent = {
      id: crypto.randomUUID(),
      characterId: character.id,
      timestamp: Date.now(),
      rating: result.rating,
      totalMistakes,
      hintUsed: hintUsedRef.current,
      durationMs: Date.now() - startedAtRef.current,
      inputDevice: getInputDevice(),
    }
    let nextSave: SaveGame = {
      ...current,
      unlockedBedIds: [...unlocked],
      masteredBedIds: [...mastered],
      seenCharacterIds: [...seen],
      cards: { ...current.cards, [character.id]: result.card },
      reviewEvents: [...current.reviewEvents.slice(-499), event],
      playerProgress: progression.player,
      updatedAt: Date.now(),
    }
    const nextCharacter = bed.characters.find(
      (candidate) => candidate.id !== character.id && isCardDue(nextSave.cards[candidate.id]),
    )
    let nextSession = progression.session
    const achievementEvents: AchievementEvent[] = [{
      type: 'kanji.completed',
      timestamp: event.timestamp,
      strokeCount: character.strokeCount,
      errorCount: totalMistakes,
      earnedXp: progression.reward.earnedXp,
      kanjiXp: progression.reward.kanjiXp,
      previousCombo: progression.reward.previousCombo,
      combo: progression.reward.combo,
      finalStrokeError: finalStrokeErrorRef.current,
    }]
    const nextBedSummary = {
      correctStrokes: bedSummaryRef.current.correctStrokes + character.strokeCount,
      errors: bedSummaryRef.current.errors + totalMistakes,
      comboBonusXp: bedSummaryRef.current.comboBonusXp + progression.reward.comboBonusXp,
      earnedXp: bedSummaryRef.current.earnedXp + progression.reward.earnedXp,
    }
    if (!nextCharacter) {
      const completedBiomes = findCompletedBiomeIds(nextSave.cards)
      const bedCompletion = completeBed(nextSave.playerProgress, nextSession, completedBiomes)
      nextSave = { ...nextSave, playerProgress: bedCompletion.player }
      nextSession = bedCompletion.session
      achievementEvents.push({
        type: 'gardenBed.completed',
        timestamp: event.timestamp,
        perfect: nextBedSummary.errors === 0,
        earnedXp: nextBedSummary.earnedXp,
        biomeId: bed.biomeId,
        completedBiomeIds: completedBiomes,
      })
    }
    saveRef.current = nextSave
    sessionRef.current = nextSession
    setLastReward(progression.reward)
    setRewardSequence((sequence) => sequence + 1)
    if (progression.reward.comboBonusXp > 0) playComboMilestoneCue(progression.reward.combo)
    bedSummaryRef.current = nextBedSummary
    setBedSummary(nextBedSummary)
    onSave(nextSave, nextSession, achievementEvents)
    window.setTimeout(() => {
      setActiveCharacterId(nextCharacter?.id ?? null)
    }, 1050)
  }, [bed, onSave])

  useEffect(() => {
    if (!writerTarget.current || !activeCharacter) return
    const initialInk = writingInkForBackdrop('fullDirty')
    mistakesRef.current = 0
    hintMistakesRef.current = 0
    hintUsedRef.current = false
    correctStrokesRef.current = 0
    finalStrokeErrorRef.current = false
    streakHighlightRef.current = 0
    clearStreakGradientRef.current?.()
    clearStreakGradientRef.current = null
    startedAtRef.current = Date.now()
    completingRef.current = false
    setCorrectStrokes(0)
    writerTarget.current.replaceChildren()

    const writer = HanziWriter.create(writerTarget.current, activeCharacter.hanzi, {
      width: Math.round(writerTarget.current.clientWidth) || 300,
      height: Math.round(writerTarget.current.clientWidth) || 300,
      padding: 18,
      showCharacter: false,
      showOutline: false,
      renderer: 'svg',
      drawingColor: initialInk.drawingColor,
      drawingWidth: 7,
      strokeColor: initialInk.completedStrokeColor,
      radicalColor: initialInk.completedStrokeColor,
      highlightColor: NORMAL_HINT_COLOR,
      highlightCompleteColor: '#4e6c56',
      acceptBackwardsStrokes: false,
      // XHR: Fetch is blocked for file:// in Android WebView / Chromium.
      charDataLoader: (char, onComplete, onError) => {
        loadHanziCharData(char).then(onComplete).catch(onError)
      },
    })
    writerRef.current = writer
    writer.quiz({
      leniency: 1,
      acceptBackwardsStrokes: false,
      showHintAfterMisses: 3,
      highlightOnComplete: false,
      onCorrectStroke: (data) => {
        settleCheatStroke('correct')
        const completedStrokes = data.strokeNum + 1
        const nextBackdropStage = battleBackdropStage(activeCharacter.strokeCount, completedStrokes)
        const nextInk = writingInkForBackdrop(nextBackdropStage)
        correctStrokesRef.current = completedStrokes
        setCorrectStrokes(completedStrokes)
        // Hanzi Writer keeps completed paths in strokeColor. Update it at the
        // same time as the backdrop so existing and newly drawn ink retain contrast.
        writer.updateColor('drawingColor', nextInk.drawingColor, { duration: 0 })
        writer.updateColor('strokeColor', nextInk.completedStrokeColor, { duration: 0 })
        writer.updateColor('radicalColor', nextInk.completedStrokeColor, { duration: 0 })
        if (mistakesRef.current === 0) {
          const highlightId = ++streakHighlightRef.current
          const intensity = streakIntensity(activeCharacter.strokeCount, completedStrokes)
          clearStreakGradientRef.current?.()
          const clearStreakGradient = setStreakGradient(writerTarget.current!, intensity)
          clearStreakGradientRef.current = clearStreakGradient
          writer.updateColor('highlightColor', streakHighlightColor(intensity), { duration: 0 })
          writer.highlightStroke(data.strokeNum, {
            onComplete: () => {
              // Do not let an earlier animation reset the colour of a newer streak.
              if (streakHighlightRef.current !== highlightId) return
              clearStreakGradient()
              clearStreakGradientRef.current = null
              writer.updateColor('highlightColor', NORMAL_HINT_COLOR, { duration: 0 })
            },
          })
        }
      },
      onMistake: (data) => {
        settleCheatStroke('wrong')
        const totalMistakes = data.totalMistakes + hintMistakesRef.current
        mistakesRef.current = totalMistakes
        if (correctStrokesRef.current === activeCharacter.strokeCount - 1) finalStrokeErrorRef.current = true
      },
      onComplete: (summary) => {
        const totalMistakes = summary.totalMistakes + hintMistakesRef.current
        if (totalMistakes === 0) {
          // The completed perfect character remains as opaque ink until the next one appears.
          const cleanInk = writingInkForBackdrop('clean')
          writer.updateColor('strokeColor', cleanInk.completedStrokeColor, { duration: 120 })
          writer.updateColor('radicalColor', cleanInk.completedStrokeColor, { duration: 120 })
        }
        finishCharacter(activeCharacter, totalMistakes)
      },
    })

    const drawCheatStroke = (backwards: boolean, expected: PendingCheatStroke['expected']) => {
      if (pendingCheatStrokeRef.current) {
        return Promise.reject(new Error('Предыдущий чит-штрих ещё обрабатывается'))
      }
      let resolveStroke!: () => void
      let rejectStroke!: (error: Error) => void
      const completed = new Promise<void>((resolve, reject) => {
        resolveStroke = resolve
        rejectStroke = reject
      })
      const timeoutId = window.setTimeout(() => {
        rejectPendingCheatStroke('Hanzi Writer не обработал чит-штрих за 3 секунды')
      }, 3_000)
      pendingCheatStrokeRef.current = {
        expected,
        resolve: resolveStroke,
        reject: rejectStroke,
        timeoutId,
      }
      void dispatchQuizStroke(writer, writerTarget.current!, correctStrokesRef.current, backwards)
        .catch((error: unknown) => {
          rejectPendingCheatStroke(error instanceof Error ? error.message : String(error))
        })
      return completed
    }
    const unregisterBattleCheats = registerBattleCheatDriver({
      drawCorrectStroke: () => drawCheatStroke(false, 'correct'),
      drawWrongStroke: () => drawCheatStroke(true, 'wrong'),
    })

    const syncWriterSize = () => {
      const target = writerTarget.current
      if (!target) return
      const raw = target.clientWidth
      if (raw < 32) return
      const size = Math.min(430, Math.max(180, Math.round(raw)))
      writer.updateDimensions({ width: size, height: size })
      const svg = target.querySelector('svg')
      if (svg) {
        // Keep pixel width/height for Hanzi Writer hit-testing; CSS scales the paint box.
        svg.style.maxWidth = '100%'
        svg.style.maxHeight = '100%'
        svg.style.overflow = 'hidden'
      }
    }
    // Layout can settle after first paint in Android WebView (immersive bars / insets).
    const frame = window.requestAnimationFrame(syncWriterSize)
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => syncWriterSize())
      : null
    resizeObserver?.observe(writerTarget.current)
    window.addEventListener('resize', syncWriterSize)
    window.visualViewport?.addEventListener('resize', syncWriterSize)
    return () => {
      unregisterBattleCheats()
      rejectPendingCheatStroke('Бой завершился до обработки чит-штриха')
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', syncWriterSize)
      window.visualViewport?.removeEventListener('resize', syncWriterSize)
      writer.cancelQuiz()
      writerTarget.current?.replaceChildren()
      writerRef.current = null
    }
  }, [activeCharacter, finishCharacter, rejectPendingCheatStroke, settleCheatStroke])

  const useHint = () => {
    if (!activeCharacter || !writerRef.current) return
    hintUsedRef.current = true
    hintMistakesRef.current += 1
    mistakesRef.current += 1
    streakHighlightRef.current += 1
    clearStreakGradientRef.current?.()
    clearStreakGradientRef.current = null
    writerRef.current.updateColor('highlightColor', NORMAL_HINT_COLOR, { duration: 0 })
    writerRef.current.highlightStroke(correctStrokesRef.current)
  }

  const infection = bedInfection(bed, save.cards)
  const visualCleanliness = battleBedCleanliness(infection)
  const artwork = battleArtworkForBiome(bed.biomeId)
  const backdropStage = activeCharacter
    ? battleBackdropStage(activeCharacter.strokeCount, correctStrokes)
    : 'clean'
  const backdropUrl = assetUrl(artwork.backgrounds[backdropStage])

  useEffect(() => {
    // All four variants are ready before the first successful stroke, avoiding
    // a flash when the battlefield changes cleanliness state.
    Object.values(artwork.backgrounds).forEach((path) => {
      const image = new Image()
      image.src = assetUrl(path)
    })
  }, [artwork])

  return (
    <main className={`battle-screen ${activeCharacter?.structure.primitive ? 'has-primitive' : ''}`}>
      <div
        className="battle-backdrop"
        style={{ backgroundImage: `url(${JSON.stringify(backdropUrl)})` }}
        aria-hidden="true"
      />
      <button className="back-button" onClick={onExit} aria-label="Вернуться в сад"><ArrowLeft /></button>

      <header className="prompt-scroll">
        <strong ref={promptTextRef}>{activeCharacter?.keyword.ru.toLocaleUpperCase('ru') ?? 'ГРЯДКА ОЧИЩЕНА'}</strong>
        {activeCharacter?.structure.primitive && (
          <p className="primitive-prompt">
            <Plus size={13} aria-hidden="true" />
            <b>{activeCharacter.structure.primitive}</b>
          </p>
        )}
      </header>

      {activeCharacter && activeCharacter.structure.components.length > 0 && (
        <button className="composition-button" onClick={() => setCompositionOpen(true)} aria-label="Показать состав иероглифа">
          <Layers size={18} /> <span>Состав</span>
        </button>
      )}

      {activeCharacter ? (
        <>
          <div className="writing-circle">
            <div className="writing-target" ref={writerTarget} aria-label={`Напишите иероглиф со значением ${activeCharacter.keyword.ru}`} />
          </div>
          <button className="hint-button" onClick={useHint}><HelpCircle size={16} /> Показать следующий штрих</button>
        </>
      ) : (
        <section className="cleared-state">
          <Flower2 />
          <p className="cleared-eyebrow">Грядка очищена</p>
          <h1>Сад снова дышит</h1>
          <p>Все сорняки на этой грядке уничтожены. Новые повторения появятся здесь по расписанию памяти.</p>
          {bedSummary.earnedXp > 0 && (
            <div className="xp-summary">
              <span>Правильные штрихи <b>+{bedSummary.correctStrokes} XP</b></span>
              <span>Ошибки <b className="is-negative">−{bedSummary.errors} XP</b></span>
              <span>Комбо <b>+{bedSummary.comboBonusXp} XP</b></span>
              <strong>Итого <b>+{bedSummary.earnedXp} XP</b></strong>
              <PlayerLevel totalXp={save.playerProgress.totalXp} />
              {gainedLevels.map((level, index) => (
                <div className="level-up-beat" style={{ animationDelay: `${.65 + index * .65}s` }} key={level}>
                  <Trophy size={18} /> Новый уровень {level}
                </div>
              ))}
            </div>
          )}
          <button className={`primary-button ${summaryReady ? 'is-ready' : ''}`} onClick={onExit}>Вернуться в сад <Sparkles size={17} /></button>
        </section>
      )}

      {activeCharacter && lastReward && (
        <div className={`xp-toast ${lastReward.comboBonusXp > 0 ? 'has-milestone' : ''}`} key={rewardSequence}>
          <strong>+{lastReward.earnedXp} XP</strong>
          {lastReward.combo > 1 && <span>КОМБО {lastReward.combo}</span>}
          {lastReward.comboBonusXp > 0 && <small>+{lastReward.comboBonusXp} за точность</small>}
        </div>
      )}

      <div className="bed-cleanliness" title="Здоровье грядки">
        <Leaf size={15} /><span><i style={{ width: `${visualCleanliness * 100}%` }} /></span>
      </div>

      {activeCharacter && isCompositionOpen && (
        <div className="composition-backdrop" onClick={(event) => {
          if (event.target === event.currentTarget) setCompositionOpen(false)
        }}>
          <section className="composition-dialog" role="dialog" aria-modal="true" aria-labelledby="composition-title">
            <button className="composition-close" onClick={() => setCompositionOpen(false)} aria-label="Закрыть состав"><X /></button>
            <p className="composition-eyebrow">Состав иероглифа</p>
            <h1 id="composition-title"><span>{activeCharacter.hanzi}</span> {activeCharacter.keyword.ru}</h1>
            <ol className="composition-list">
              {activeCharacter.structure.components.map((component, index) => (
                <li key={`${component.hanzi}:${component.keyword}:${index}`}>
                  <span className="component-hanzi">{component.hanzi}</span>
                  <span>{component.keyword}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </main>
  )
}

function MainMenu({ onEnter, onAbout, onSupport, onExit }: {
  onEnter: () => void
  onAbout: () => void
  onSupport: () => void
  onExit: () => void
}) {
  return (
    <div className="welcome-screen">
      <div className="welcome-vignette" />
      <section className="welcome-card">
        <div className="seal"><span>忆</span></div>
        <p className="eyebrow">Изучи китайскую письменность</p>
        <h1>Сад иероглифов</h1>
        <p>Добро пожаловать в Сад иероглифов! Очищай его от сорняков, запоминай начертания иероглифов и тренируй механическую память!</p>
        <div className="welcome-rule"><span /> кисть поможет запомнить <span /></div>
        <nav className="main-menu" aria-label="Главное меню">
          <button className="primary-button" onClick={onEnter}>Войти в сад <Leaf size={18} /></button>
          <button className="menu-button" onClick={onAbout}>Об игре <BookOpen size={18} /></button>
          <button className="menu-button" onClick={onSupport}>Поддержать <HandHeart size={18} /></button>
          <button className="menu-button menu-exit-button" onClick={onExit}>Выход <LogOut size={18} /></button>
        </nav>
      </section>
    </div>
  )
}

function MenuInfoScreen({ kind, onBack }: { kind: 'about' | 'support'; onBack: () => void }) {
  const about = kind === 'about'
  return (
    <div className="welcome-screen">
      <div className="welcome-vignette" />
      <section className="welcome-card menu-info-card">
        <div className="seal"><span>忆</span></div>
        <p className="eyebrow">Сад иероглифов</p>
        <h1>{about ? 'Об игре' : 'Поддержать'}</h1>
        <p>{about ? 'Здесь появится информация об игре.' : 'Здесь появится информация о способах поддержать проект.'}</p>
        <button className="menu-button" onClick={onBack}><ArrowLeft size={18} /> Вернуться в главное меню</button>
      </section>
    </div>
  )
}

function exitApplication() {
  if (window.location.protocol === 'file:') {
    window.location.assign('hanzi-garden://exit')
    return
  }
  window.close()
}

export default function App() {
  const [save, setSave] = useState<SaveGame>(initialSave)
  const [loaded, setLoaded] = useState(false)
  const [screen, setScreen] = useState<Screen>('menu')
  const [activeBed, setActiveBed] = useState<BedDefinition | null>(null)
  const [camera, setCamera] = useState<CameraState>(initialCamera)
  const [session, setSession] = useState<SessionProgress>(initialSessionProgress)
  const [achievementQueue, setAchievementQueue] = useState<string[]>([])
  const appSaveRef = useRef(save)
  const appSessionRef = useRef(session)

  useEffect(() => {
    loadSave().then((stored) => {
      setSave(stored)
      setLoaded(true)
    })
  }, [])

  useEffect(() => { appSaveRef.current = save }, [save])
  useEffect(() => { appSessionRef.current = session }, [session])

  const applyLoadedSave = useCallback((loadedSave: SaveGame) => {
    setSave(loadedSave)
    setActiveBed(null)
    setScreen('garden')
  }, [])

  useEffect(() => {
    if (!loaded) return
    return installGameCheats({ applyLoadedSave })
  }, [applyLoadedSave, loaded])

  const updateSave = useCallback((nextSave: SaveGame) => {
    appSaveRef.current = nextSave
    setSave(nextSave)
    void persistSave(nextSave)
  }, [])

  const updateProgress = useCallback((nextSave: SaveGame, nextSession: SessionProgress, events: AchievementEvent[]) => {
    const processed = processAchievementEvents(nextSave.achievements, nextSave.playerProgress, nextSession, events)
    const saveWithAchievements = { ...nextSave, achievements: processed.state }
    if (processed.unlocked.length > 0) setAchievementQueue((queue) => [...queue, ...processed.unlocked])
    appSessionRef.current = nextSession
    setSession(nextSession)
    updateSave(saveWithAchievements)
  }, [updateSave])

  useEffect(() => {
    if (!loaded) return
    let lastInteractionAt = Date.now()
    let lastTickAt = Date.now()
    const noteInteraction = () => { lastInteractionAt = Date.now() }
    const interactionEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    interactionEvents.forEach((name) => window.addEventListener(name, noteInteraction, { passive: true }))
    const interval = window.setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastTickAt
      lastTickAt = now
      if (document.visibilityState !== 'visible' || now - lastInteractionAt > SESSION_IDLE_TIMEOUT_MS) return
      const nextSession = advanceActiveSession(appSessionRef.current, elapsed)
      appSessionRef.current = nextSession
      setSession(nextSession)
      const current = appSaveRef.current
      const processed = processAchievementEvents(current.achievements, current.playerProgress, nextSession, [{
        type: 'session.activeTime', timestamp: now, activeMs: nextSession.activeMs,
      }])
      if (processed.unlocked.length === 0) return
      const nextSave = { ...current, achievements: processed.state, updatedAt: now }
      appSaveRef.current = nextSave
      setSave(nextSave)
      void persistSave(nextSave)
      setAchievementQueue((queue) => [...queue, ...processed.unlocked])
    }, 5_000)
    return () => {
      window.clearInterval(interval)
      interactionEvents.forEach((name) => window.removeEventListener(name, noteInteraction))
    }
  }, [loaded])

  const enterBed = (bed: BedDefinition) => {
    if (!save.unlockedBedIds.includes(bed.id)) return
    // The source data contains one one-character list. Its second half is an
    // intentional empty bed under the required midpoint split, so it is
    // immediately mastered when reached and cannot block garden progression.
    if (bed.characterIds.length === 0) {
      const mastered = new Set(save.masteredBedIds)
      const unlocked = new Set(save.unlockedBedIds)
      mastered.add(bed.id)
      bed.neighbors.forEach((id) => unlocked.add(id))
      updateSave({
        ...save,
        masteredBedIds: [...mastered],
        unlockedBedIds: [...unlocked],
        updatedAt: Date.now(),
      })
      return
    }
    const nextSave = { ...save, lastActiveBedId: bed.id, updatedAt: Date.now() }
    updateSave(nextSave)
    setActiveBed(bed)
    setScreen('battle')
  }

  let content
  if (!loaded) content = <div className="loading-screen"><Leaf /> Заходим в сад…</div>
  else if (screen === 'menu') {
    content = <MainMenu onEnter={() => setScreen('garden')} onAbout={() => setScreen('about')} onSupport={() => setScreen('support')} onExit={exitApplication} />
  } else if (screen === 'about' || screen === 'support') {
    content = <MenuInfoScreen kind={screen} onBack={() => setScreen('menu')} />
  } else if (screen === 'battle' && activeBed) {
    content = <BattleScreen bed={activeBed} save={save} session={session} onSave={updateProgress} onExit={() => setScreen('garden')} />
  } else if (screen === 'stats') {
    content = <StatisticsScreen save={save} session={session} onBack={() => setScreen('garden')} />
  } else {
    content = <GardenScreen
      save={save}
      camera={camera}
      onCameraChange={setCamera}
      onEnter={enterBed}
      onMainMenu={() => setScreen('menu')}
      onStatistics={() => setScreen('stats')}
    />
  }

  return (
    <>
      {content}
      {achievementQueue[0] && <AchievementPopup achievementId={achievementQueue[0]} onClose={() => setAchievementQueue((queue) => queue.slice(1))} />}
    </>
  )
}
