import type { StrokeError } from './strokeErrorClassifier'

/** Below this, do not show an order hint — we are not sure which later stroke was attempted. */
export const SPECIFIC_ORDER_CONFIDENCE = 0.7

export const STROKE_ERROR_HINT_DURATION_MS = 2800

export type StrokeErrorHintCopy = {
  type: 'wrong-order' | 'wrong-direction'
  title: string
  detail: string
}

/**
 * Player-facing copy for a classified handwriting miss.
 * Internal type names stay out of the UI; the product UI language is Russian.
 * Returns null when the miss is not specific enough to explain.
 */
export function strokeErrorCopy(error: StrokeError): StrokeErrorHintCopy | null {
  switch (error.type) {
    case 'wrong-order':
      if (error.confidence < SPECIFIC_ORDER_CONFIDENCE) return null
      return {
        type: error.type,
        title: 'Неправильный порядок черт',
        detail: 'Кажется ты поспешил нарисовать эту черту',
      }
    case 'wrong-direction':
      return {
        type: error.type,
        title: 'Неверное направление',
        detail: 'Проведи эту черту в другую сторону.',
      }
    case 'bad-shape':
    case 'unknown':
      return null
  }
}

export function isSameStrokeErrorHint(current: StrokeErrorHintCopy | null, next: StrokeErrorHintCopy): boolean {
  return Boolean(
    current
    && current.type === next.type
    && current.title === next.title
    && current.detail === next.detail,
  )
}
