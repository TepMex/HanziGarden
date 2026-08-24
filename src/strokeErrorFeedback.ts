import { displayStrokeNumber, type StrokeError } from './strokeErrorClassifier'

/** Below this, name the expected stroke but not a specific later stroke. */
export const SPECIFIC_ORDER_CONFIDENCE = 0.7

export const STROKE_ERROR_HINT_DURATION_MS = 2800

export type StrokeErrorHintCopy = {
  type: StrokeError['type']
  title: string
  detail: string
}

/**
 * Player-facing copy for a classified handwriting miss.
 * Internal type names stay out of the UI; the product UI language is Russian.
 */
export function strokeErrorCopy(error: StrokeError): StrokeErrorHintCopy {
  switch (error.type) {
    case 'wrong-order':
      return {
        type: error.type,
        title: 'Неправильный порядок черт',
        detail: error.confidence >= SPECIFIC_ORDER_CONFIDENCE
          ? `Сейчас нужно написать черту ${displayStrokeNumber(error.expectedStroke)}, а ты начал с черты ${displayStrokeNumber(error.attemptedStroke)}.`
          : 'Сначала напиши выделенную черту.',
      }
    case 'wrong-direction':
      return {
        type: error.type,
        title: 'Неверное направление',
        detail: 'Проведи эту черту в другую сторону.',
      }
    case 'bad-shape':
    case 'unknown':
      return {
        type: error.type,
        title: 'Попробуй ещё раз',
        detail: 'Следуй форме выделенной черты.',
      }
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
