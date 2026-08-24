import HanziWriter, { type HanziWriterOptions, type QuizOptions } from 'hanzi-writer'
import { loadHanziCharData } from '../hanziData'
import type { HanziWriterDemoType } from '../walkthrough'

export type WriterStatus = 'loading' | 'ready' | 'error'

export type HanziWriterDemoSpec = {
  character: string
  mode: HanziWriterDemoType
  options?: Record<string, unknown>
}

export type HanziWriterDemoHandle = {
  replay(): Promise<void>
  destroy(): void
}

export type WriterFactory = (
  element: HTMLElement,
  character: string,
  options: Partial<HanziWriterOptions>,
) => HanziWriter

const defaultCreateOptions = {
  padding: 12,
  showCharacter: false,
  showOutline: true,
  strokeColor: '#382f25',
  outlineColor: '#c4b28d',
  radicalColor: '#382f25',
  drawingColor: '#382f25',
  highlightColor: '#6d5269',
  strokeAnimationSpeed: 0.85,
  delayBetweenStrokes: 260,
  renderer: 'svg' as const,
}

function writerSize(target: HTMLElement): number {
  return Math.min(320, Math.max(120, Math.round(target.clientWidth) || 220))
}

function asWriterOptions(options: Record<string, unknown> | undefined): Partial<HanziWriterOptions> {
  if (!options) return {}
  return options as Partial<HanziWriterOptions>
}

function asQuizOptions(options: Record<string, unknown> | undefined): Partial<QuizOptions> {
  if (!options) return {}
  return options as Partial<QuizOptions>
}

export function mountHanziWriterDemo(
  target: HTMLElement,
  spec: HanziWriterDemoSpec,
  hooks: {
    onStatus?: (status: WriterStatus) => void
    createWriter?: WriterFactory
  } = {},
): HanziWriterDemoHandle {
  const { onStatus, createWriter = (element, character, options) => HanziWriter.create(element, character, options) } = hooks
  let destroyed = false
  let replayGeneration = 0
  target.replaceChildren()
  onStatus?.('loading')

  const size = writerSize(target)
  const writer = createWriter(target, spec.character, {
    ...defaultCreateOptions,
    ...asWriterOptions(spec.options),
    width: size,
    height: size,
    charDataLoader: (char, onComplete, onError) => {
      loadHanziCharData(char).then(onComplete).catch(onError)
    },
    onLoadCharDataSuccess: () => {
      if (!destroyed) onStatus?.('ready')
    },
    onLoadCharDataError: () => {
      if (!destroyed) onStatus?.('error')
    },
  })

  const startDemo = async (generation: number) => {
    if (destroyed || generation !== replayGeneration) return
    if (spec.mode === 'hanzi-writer-quiz') {
      await writer.quiz(asQuizOptions(spec.options))
      return
    }
    await writer.animateCharacter()
  }

  void startDemo(replayGeneration)
  const frame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => {
      if (destroyed) return
      const nextSize = writerSize(target)
      writer.updateDimensions({ width: nextSize, height: nextSize })
    })
    : 0

  return {
    async replay() {
      if (destroyed) return
      const generation = ++replayGeneration
      await writer.pauseAnimation()
      if (destroyed || generation !== replayGeneration) return
      if (spec.mode === 'hanzi-writer-quiz') {
        writer.cancelQuiz()
        await writer.quiz(asQuizOptions(spec.options))
        return
      }
      await writer.hideCharacter({ duration: 0 })
      if (destroyed || generation !== replayGeneration) return
      await writer.animateCharacter()
    },
    destroy() {
      destroyed = true
      replayGeneration += 1
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
      void writer.pauseAnimation()
      writer.cancelQuiz()
      target.replaceChildren()
    },
  }
}
