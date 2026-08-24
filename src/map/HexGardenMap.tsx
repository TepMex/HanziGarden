import { useCallback, useEffect, useRef, useState } from 'react'
import type { SaveGame } from '../db'
import type { GardenHexStatus } from '../garden/gardenState'
import {
  baseMapScale,
  cameraForGardenPoint,
  clampCamera,
  clampZoom,
  type CameraState,
  type Point,
  type Viewport,
  zoomAroundPoint,
} from './cameraMath'
import { GardenDebugPanel } from './GardenDebugPanel'
import { HexGardenRenderer, type RevealPhase } from './HexGardenRenderer'
import { GARDEN_HEIGHT, GARDEN_WIDTH } from '../data/mapLayout'

type HexGardenMapProps = {
  save: SaveGame
  camera: CameraState
  onCameraChange: (camera: CameraState) => void
  onEnterHex: (id: string) => void
  onClearHex: (id: string) => void
  onSave: (save: SaveGame) => void
}

type Drag = { pointerId: number; point: Point; camera: CameraState }
type Pinch = { distance: number; gardenPoint: Point; camera: CameraState }

const DRAG_THRESHOLD = 12

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
}

function localPoint(event: React.PointerEvent<HTMLElement>, viewport: DOMRect): Point {
  return { x: event.clientX - viewport.left, y: event.clientY - viewport.top }
}

export function HexGardenMap({
  save,
  camera,
  onCameraChange,
  onEnterHex,
  onClearHex,
  onSave,
}: HexGardenMapProps) {
  const viewportRef = useRef<HTMLElement>(null)
  const gardenRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef(camera)
  const pointersRef = useRef(new Map<number, Point>())
  const dragRef = useRef<Drag | null>(null)
  const pinchRef = useRef<Pinch | null>(null)
  const movedRef = useRef(false)
  const wheelCommitRef = useRef<number | null>(null)
  const revealTimersRef = useRef<number[]>([])
  const [reveal, setReveal] = useState<RevealPhase>(null)
  const [showCoordinates, setShowCoordinates] = useState(false)
  const [showBiomeIds, setShowBiomeIds] = useState(false)
  const [noActionPulse, setNoActionPulse] = useState(false)

  const getViewport = useCallback((): Viewport | null => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return rect ? { width: rect.width, height: rect.height } : null
  }, [])

  const paintCamera = useCallback((next: CameraState): CameraState | null => {
    const viewport = getViewport()
    const garden = gardenRef.current
    if (!viewport || !garden) return null
    const clamped = clampCamera(next, viewport)
    const scale = baseMapScale(viewport) * clamped.zoom
    cameraRef.current = clamped
    garden.style.transform = `translate3d(${viewport.width / 2 + clamped.x}px, ${viewport.height / 2 + clamped.y}px, 0) scale(${scale}) translate3d(-${GARDEN_WIDTH / 2}px, -${GARDEN_HEIGHT / 2}px, 0)`
    return clamped
  }, [getViewport])

  const commitCamera = useCallback(() => onCameraChange(cameraRef.current), [onCameraChange])

  useEffect(() => {
    paintCamera(camera)
  }, [camera, paintCamera])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(() => {
      const next = paintCamera(cameraRef.current)
      if (next) onCameraChange(next)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [onCameraChange, paintCamera])

  useEffect(() => () => {
    if (wheelCommitRef.current) window.clearTimeout(wheelCommitRef.current)
    revealTimersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const viewport = getViewport()
      if (!viewport) return
      const intensity = event.deltaMode === 1 ? 0.045 : 0.0015
      const targetZoom = clampZoom(cameraRef.current.zoom * Math.exp(-event.deltaY * intensity), viewport)
      const point = {
        x: event.clientX - element.getBoundingClientRect().left,
        y: event.clientY - element.getBoundingClientRect().top,
      }
      paintCamera(zoomAroundPoint(cameraRef.current, point, targetZoom, viewport))
      if (wheelCommitRef.current) window.clearTimeout(wheelCommitRef.current)
      wheelCommitRef.current = window.setTimeout(commitCamera, 120)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [commitCamera, getViewport, paintCamera])

  const startPinch = () => {
    const viewport = getViewport()
    const points = [...pointersRef.current.values()]
    if (!viewport || points.length !== 2) return
    const center = midpoint(points[0]!, points[1]!)
    pinchRef.current = {
      distance: distance(points[0]!, points[1]!),
      gardenPoint: {
        x: GARDEN_WIDTH / 2 + (center.x - viewport.width / 2 - cameraRef.current.x) / (baseMapScale(viewport) * cameraRef.current.zoom),
        y: GARDEN_HEIGHT / 2 + (center.y - viewport.height / 2 - cameraRef.current.y) / (baseMapScale(viewport) * cameraRef.current.zoom),
      },
      camera: cameraRef.current,
    }
    dragRef.current = null
  }

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (!(event.target instanceof Element && event.target.closest('.garden-hex'))) {
      viewport.setPointerCapture(event.pointerId)
    }
    pointersRef.current.set(event.pointerId, localPoint(event, viewport.getBoundingClientRect()))
    movedRef.current = false
    if (pointersRef.current.size === 1) {
      dragRef.current = {
        pointerId: event.pointerId,
        point: pointersRef.current.get(event.pointerId)!,
        camera: cameraRef.current,
      }
    } else if (pointersRef.current.size === 2) {
      startPinch()
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const element = viewportRef.current
    const viewport = getViewport()
    if (!element || !viewport || !pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, localPoint(event, element.getBoundingClientRect()))
    const points = [...pointersRef.current.values()]
    if (points.length === 2 && pinchRef.current) {
      const pinch = pinchRef.current
      const nextDistance = distance(points[0]!, points[1]!)
      if (pinch.distance <= 0) return
      paintCamera(cameraForGardenPoint(
        pinch.gardenPoint,
        midpoint(points[0]!, points[1]!),
        clampZoom(pinch.camera.zoom * nextDistance / pinch.distance, viewport),
        viewport,
      ))
      movedRef.current = true
      return
    }
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = points[0]!
    const deltaX = point.x - drag.point.x
    const deltaY = point.y - drag.point.y
    if (!movedRef.current && Math.hypot(deltaX, deltaY) <= DRAG_THRESHOLD) return
    movedRef.current = true
    if (!element.hasPointerCapture(event.pointerId)) element.setPointerCapture(event.pointerId)
    paintCamera({ ...drag.camera, x: drag.camera.x + deltaX, y: drag.camera.y + deltaY })
  }

  const finishPointer = (event: React.PointerEvent<HTMLElement>) => {
    const shouldCommit = movedRef.current
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size === 1) {
      const [pointerId, point] = [...pointersRef.current.entries()][0]!
      dragRef.current = { pointerId, point, camera: cameraRef.current }
      pinchRef.current = null
    } else {
      dragRef.current = null
      pinchRef.current = null
    }
    if (shouldCommit) commitCamera()
  }

  const activate = (id: string, status: GardenHexStatus) => {
    if (movedRef.current || reveal) return
    if (status === 'cleared') {
      onEnterHex(id)
      return
    }
    if (save.pendingClearActions <= 0) {
      setNoActionPulse(true)
      const timer = window.setTimeout(() => setNoActionPulse(false), 700)
      revealTimersRef.current.push(timer)
      return
    }
    setReveal({ id, phase: 'clearing' })
    const clearingTimer = window.setTimeout(() => {
      onClearHex(id)
      setReveal({ id, phase: 'revealed' })
      const settleTimer = window.setTimeout(() => setReveal(null), 900)
      revealTimersRef.current.push(settleTimer)
    }, 520)
    revealTimersRef.current.push(clearingTimer)
  }

  return (
    <section
      className={`garden-map-viewport hex-garden-map-viewport ${noActionPulse ? 'has-no-action-pulse' : ''}`}
      ref={viewportRef}
      aria-label="Карта гексагонального сада: перетаскивайте для перемещения, используйте колесо или щипок для масштаба"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    >
      <div className="hex-garden-background" aria-hidden="true" />
      <div className="garden-map-content hex-garden-map-content" ref={gardenRef}>
        <HexGardenRenderer
          save={save}
          reveal={reveal}
          showCoordinates={showCoordinates}
          showBiomeIds={showBiomeIds}
          onActivate={activate}
        />
      </div>
      {save.pendingClearActions <= 0 && (
        <p className="garden-action-hint" role="status">
          Откройте очищенную клетку и завершите следующий иероглиф, чтобы получить расчистку
        </p>
      )}
      {import.meta.env.DEV && (
        <GardenDebugPanel
          save={save}
          showCoordinates={showCoordinates}
          showBiomeIds={showBiomeIds}
          onShowCoordinates={setShowCoordinates}
          onShowBiomeIds={setShowBiomeIds}
          onSave={onSave}
        />
      )}
    </section>
  )
}
