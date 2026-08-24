import { useEffect, useRef, useState } from 'react'
import type { HanziWriterDemoType } from '../walkthrough'
import { mountHanziWriterDemo, type HanziWriterDemoHandle, type WriterStatus } from './writerAdapter'

export function HanziWriterDemo({
  character,
  mode,
  options,
  replayNonce = 0,
}: {
  character: string
  mode: HanziWriterDemoType
  options?: Record<string, unknown>
  replayNonce?: number
}) {
  const targetRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HanziWriterDemoHandle | null>(null)
  const [status, setStatus] = useState<WriterStatus>('loading')

  useEffect(() => {
    const target = targetRef.current
    if (!target) return
    setStatus('loading')
    const handle = mountHanziWriterDemo(target, { character, mode, options }, { onStatus: setStatus })
    handleRef.current = handle
    return () => {
      handle.destroy()
      if (handleRef.current === handle) handleRef.current = null
    }
  }, [character, mode, options])

  useEffect(() => {
    if (replayNonce === 0) return
    void handleRef.current?.replay()
  }, [replayNonce])

  return (
    <div className={`walkthrough-demo is-${status}`}>
      <div className="walkthrough-demo-target" ref={targetRef} />
      {status === 'loading' && <p className="walkthrough-demo-status">Загрузка начертания…</p>}
      {status === 'error' && <p className="walkthrough-demo-status" role="alert">Не удалось загрузить иероглиф</p>}
    </div>
  )
}
