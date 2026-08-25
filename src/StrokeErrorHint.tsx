import { ListOrdered, Undo2 } from 'lucide-react'
import type { StrokeErrorHintCopy } from './strokeErrorFeedback'

const icons = {
  'wrong-order': ListOrdered,
  'wrong-direction': Undo2,
} as const

export function StrokeErrorHint({ hint }: { hint: StrokeErrorHintCopy }) {
  const Icon = icons[hint.type]
  return (
    <div className="stroke-error-hint" role="status" aria-live="polite">
      <Icon size={16} aria-hidden="true" />
      <div>
        <strong>{hint.title}</strong>
        <span>{hint.detail}</span>
      </div>
    </div>
  )
}
