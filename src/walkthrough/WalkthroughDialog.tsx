import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { RotateCcw, Sparkles } from 'lucide-react'
import { demoCharacter, type HanziWalkthrough } from '../walkthrough'
import { HanziWriterDemo } from './HanziWriterDemo'

export function WalkthroughDialog({
  walkthrough,
  demo,
  onReplay,
  onContinue,
}: {
  walkthrough: HanziWalkthrough
  demo?: ReactNode
  onReplay?: () => void
  onContinue: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const [replayNonce, setReplayNonce] = useState(0)
  const character = demoCharacter(walkthrough)
  const mode = walkthrough.demo?.type ?? 'hanzi-writer-animation'

  const replay = () => {
    setReplayNonce((nonce) => nonce + 1)
    onReplay?.()
  }

  useEffect(() => {
    dialogRef.current?.focus()
  }, [walkthrough.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onContinue()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onContinue])

  return (
    <div className="walkthrough-backdrop">
      <section
        className="walkthrough-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-walkthrough-id={walkthrough.id}
        tabIndex={-1}
        ref={dialogRef}
      >
        <p className="walkthrough-eyebrow">Правило порядка черт</p>
        <h1 id={titleId}>{walkthrough.title}</h1>
        {walkthrough.chineseTitle && (
          <p className="walkthrough-chinese" lang="zh-Hans">{walkthrough.chineseTitle}</p>
        )}
        <p className="walkthrough-description" id={descriptionId}>{walkthrough.description}</p>
        {demo ?? (
          <HanziWriterDemo
            character={character}
            mode={mode}
            options={walkthrough.demo?.options}
            replayNonce={replayNonce}
          />
        )}
        <div className="walkthrough-actions">
          <button type="button" className="menu-button" onClick={replay}>
            <RotateCcw size={16} /> Показать ещё раз
          </button>
          <button type="button" className="primary-button" onClick={onContinue}>
            Понятно <Sparkles size={17} />
          </button>
        </div>
      </section>
    </div>
  )
}
