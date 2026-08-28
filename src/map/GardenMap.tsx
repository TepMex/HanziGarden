import { useCallback, useEffect, useRef, useState } from 'react'
import { Leaf, LockKeyhole } from 'lucide-react'
import { assetUrl } from '../assetUrl'
import { beds, type BedDefinition } from '../data/model'
import { automaticFocusBoundsForCells, bedBounds, bedQuad, biomes, cellQuad, quadPoint, GARDEN_HEIGHT, GARDEN_WIDTH, type NormalizedPoint, type NormalizedQuad } from '../data/mapLayout'
import type { SaveGame } from '../db'
import { bedInfection } from '../garden'
import {
  baseMapScale,
  cameraForGardenPoint,
  clampCamera,
  clampZoom,
  mobileCameraForGardenBounds,
  type CameraState,
  type Point,
  type Viewport,
  zoomAroundPoint,
} from './cameraMath'
import { GardenRevealCanvas } from './GardenRevealCanvas'

type GardenMapProps = {
  save: SaveGame
  camera: CameraState
  focusBedId: string | null
  gridVisible: boolean
  onCameraChange: (camera: CameraState) => void
  onEnterBed: (bed: BedDefinition) => void
}

type Drag = { pointerId: number; point: Point; camera: CameraState }
type Pinch = { distance: number; gardenPoint: Point; camera: CameraState }
type MapLoadState = 'loading' | 'ready' | 'error'

const debugMap = new URLSearchParams(window.location.search).get('debugMap') === '1'
const DRAG_THRESHOLD = 12
const GRID_URL = assetUrl('assets/garden-grid.svg')

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
}

function localPoint(event: React.PointerEvent<HTMLElement>, viewport: DOMRect): Point {
  return { x: event.clientX - viewport.left, y: event.clientY - viewport.top }
}

function rectToGarden(rect: { x: number; y: number; width: number; height: number }) {
  return { x: rect.x * GARDEN_WIDTH, y: rect.y * GARDEN_HEIGHT, width: rect.width * GARDEN_WIDTH, height: rect.height * GARDEN_HEIGHT }
}

function quadPoints(quad: NormalizedQuad): string {
  return [
    quad.tl, quad.tr, quad.br, quad.bl,
  ].map((point) => `${point.x * GARDEN_WIDTH},${point.y * GARDEN_HEIGHT}`).join(' ')
}

function gardenPoint(point: NormalizedPoint): { x: number; y: number } {
  return { x: point.x * GARDEN_WIDTH, y: point.y * GARDEN_HEIGHT }
}

function FineGridOverlay() {
  return (
    <svg className="garden-map-cell-grid" viewBox={`0 0 ${GARDEN_WIDTH} ${GARDEN_HEIGHT}`} aria-hidden="true">
      {biomes.flatMap((biome) => {
        const columns = biome.index === 0 ? 2 : 3
        const verticalLines = Array.from({ length: columns - 1 }, (_, index) => {
          const amount = (index + 1) / columns
          const start = gardenPoint(quadPoint(biome.mapQuad, amount, 0))
          const end = gardenPoint(quadPoint(biome.mapQuad, amount, 1))
          return <line key={`${biome.id}:column:${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        })
        const horizontalLines = Array.from({ length: 4 }, (_, index) => {
          const amount = (index + 1) / 5
          const start = gardenPoint(quadPoint(biome.mapQuad, 0, amount))
          const end = gardenPoint(quadPoint(biome.mapQuad, 1, amount))
          return <line key={`${biome.id}:row:${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        })
        return [...verticalLines, ...horizontalLines]
      })}
    </svg>
  )
}

function bedClipPath(quad: NormalizedQuad): string {
  const bounds = bedBoundsFromQuad(quad)
  const points = [quad.tl, quad.tr, quad.br, quad.bl].map((point) => {
    const x = (point.x - bounds.x) / bounds.width * 100
    const y = (point.y - bounds.y) / bounds.height * 100
    return `${x}% ${y}%`
  })
  return `polygon(${points.join(', ')})`
}

function bedBoundsFromQuad(quad: NormalizedQuad) {
  const xs = [quad.tl.x, quad.tr.x, quad.bl.x, quad.br.x]
  const ys = [quad.tl.y, quad.tr.y, quad.bl.y, quad.br.y]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function MapDebugOverlay() {
  return (
    <svg className="map-debug-overlay" viewBox={`0 0 ${GARDEN_WIDTH} ${GARDEN_HEIGHT}`} aria-hidden="true">
      {biomes.map((biome) => (
        <polygon key={biome.id} points={quadPoints(biome.mapQuad)} className="debug-biome" />
      ))}
      {beds.flatMap((bed) => bed.cells.map((cell) => (
        <polygon key={`${bed.id}:${cell.x}:${cell.y}`} points={quadPoints(cellQuad(cell))} className="debug-cell" />
      )))}
      {beds.map((bed) => {
        const rect = rectToGarden(bedBounds(bed.cells))
        return (
          <g key={bed.id}>
            <polygon points={quadPoints(bedQuad(bed.cells))} className="debug-bed" />
            <text x={rect.x + 5} y={rect.y + 15}>{bed.id}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** A transformed garden. Weed mask re-renders only for save changes, never for camera movement. */
export function GardenMap({ save, camera, focusBedId, gridVisible, onCameraChange, onEnterBed }: GardenMapProps) {
  const viewportRef = useRef<HTMLElement>(null)
  const gardenRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef(camera)
  const pointersRef = useRef(new Map<number, Point>())
  const dragRef = useRef<Drag | null>(null)
  const pinchRef = useRef<Pinch | null>(null)
  const movedRef = useRef(false)
  const wheelCommitRef = useRef<number | null>(null)
  const [lockedPulseId, setLockedPulseId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<MapLoadState>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const unlockedBedIds = new Set(save.unlockedBedIds)
  const revealReady = useCallback(() => setLoadState('ready'), [])
  const revealFailed = useCallback(() => setLoadState('error'), [])

  const getViewport = useCallback((): Viewport | null => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return rect ? { width: rect.width, height: rect.height } : null
  }, [])

  const paintCamera = useCallback((next: CameraState, transition = false): CameraState | null => {
    const viewport = getViewport()
    const garden = gardenRef.current
    if (!viewport || !garden) return null
    const clamped = clampCamera(next, viewport)
    const renderedScale = baseMapScale(viewport) * clamped.zoom
    cameraRef.current = clamped
    garden.style.transition = transition ? 'transform 360ms cubic-bezier(.2,.75,.2,1)' : 'none'
    garden.style.transform = `translate3d(${viewport.width / 2 + clamped.x}px, ${viewport.height / 2 + clamped.y}px, 0) scale(${renderedScale}) translate3d(-${GARDEN_WIDTH / 2}px, -${GARDEN_HEIGHT / 2}px, 0)`
    return clamped
  }, [getViewport])

  const commitCamera = useCallback(() => onCameraChange(cameraRef.current), [onCameraChange])

  useEffect(() => {
    paintCamera(camera)
  }, [camera, paintCamera])

  useEffect(() => {
    const viewport = getViewport()
    const bed = beds.find((candidate) => candidate.id === focusBedId)
    if (!viewport || !bed) return
    const bounds = rectToGarden(automaticFocusBoundsForCells(bed.cells))
    const focused = mobileCameraForGardenBounds(bounds, viewport, 0.1)
    if (!focused) return
    const painted = paintCamera(focused, true)
    if (painted) onCameraChange(painted)
  }, [focusBedId, getViewport, onCameraChange, paintCamera])

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
      const point = { x: event.clientX - element.getBoundingClientRect().left, y: event.clientY - element.getBoundingClientRect().top }
      paintCamera(zoomAroundPoint(cameraRef.current, point, targetZoom, viewport))
      if (wheelCommitRef.current) window.clearTimeout(wheelCommitRef.current)
      wheelCommitRef.current = window.setTimeout(commitCamera, 120)
    }

    // React's onWheel is passive in Chromium; Android needs preventDefault to keep map zoom from scrolling the WebView.
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [commitCamera, getViewport, paintCamera])

  const startPinch = () => {
    const viewport = getViewport()
    const pointerValues = [...pointersRef.current.values()]
    if (!viewport || pointerValues.length !== 2) return
    const center = midpoint(pointerValues[0]!, pointerValues[1]!)
    pinchRef.current = {
      distance: distance(pointerValues[0]!, pointerValues[1]!),
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
    // Capturing immediately makes mobile browsers send the resulting click to
    // the garden container instead of the bed button.  A real drag captures
    // later, after it crosses the gesture threshold.
    if (!(event.target instanceof Element && event.target.closest('.bed-hotspot'))) {
      viewport.setPointerCapture(event.pointerId)
    }
    pointersRef.current.set(event.pointerId, localPoint(event, viewport.getBoundingClientRect()))
    movedRef.current = false
    if (pointersRef.current.size === 1) {
      dragRef.current = { pointerId: event.pointerId, point: pointersRef.current.get(event.pointerId)!, camera: cameraRef.current }
    } else if (pointersRef.current.size === 2) {
      startPinch()
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const viewportElement = viewportRef.current
    const viewport = getViewport()
    if (!viewportElement || !viewport || !pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, localPoint(event, viewportElement.getBoundingClientRect()))
    const pointerValues = [...pointersRef.current.values()]
    if (pointerValues.length === 2 && pinchRef.current) {
      const pinch = pinchRef.current
      const nextDistance = distance(pointerValues[0]!, pointerValues[1]!)
      if (pinch.distance <= 0) return
      const next = cameraForGardenPoint(pinch.gardenPoint, midpoint(pointerValues[0]!, pointerValues[1]!), clampZoom(pinch.camera.zoom * nextDistance / pinch.distance, viewport), viewport)
      paintCamera(next)
      movedRef.current = true
      return
    }
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = pointerValues[0]!
    const deltaX = point.x - drag.point.x
    const deltaY = point.y - drag.point.y
    // Touch emulation (and some trackpads) reports a few pixels of movement
    // while completing an otherwise ordinary tap.  Keep taps reliable without
    // compromising intentional map panning.
    if (!movedRef.current && Math.hypot(deltaX, deltaY) <= DRAG_THRESHOLD) return
    movedRef.current = true
    if (!viewportElement.hasPointerCapture(event.pointerId)) viewportElement.setPointerCapture(event.pointerId)
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

  const activateBed = (bed: BedDefinition) => {
    if (save.unlockedBedIds.includes(bed.id)) {
      onEnterBed(bed)
      return
    }
    setLockedPulseId(bed.id)
    window.setTimeout(() => setLockedPulseId((current) => current === bed.id ? null : current), 500)
  }

  return (
    <section
      className={`garden-map-viewport ${loadState === 'error' ? 'has-map-error' : ''}`}
      ref={viewportRef}
      aria-label="Карта сада: перетаскивайте для перемещения, используйте колесо или щипок для масштаба"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    >
      <div className={`garden-map-content ${loadState === 'ready' ? 'is-ready' : ''}`} ref={gardenRef} aria-hidden={loadState !== 'ready'}>
        <GardenRevealCanvas save={save} loadAttempt={loadAttempt} onReady={revealReady} onError={revealFailed} />
        <div className={`garden-map-grid ${gridVisible ? 'is-visible' : ''}`} aria-hidden="true">
          <img className="garden-map-grid-source" src={GRID_URL} alt="" draggable={false} />
          <FineGridOverlay />
        </div>
        <div className="garden-map-hotspots">
          {beds.map((bed) => {
            const rect = bedBounds(bed.cells)
            const quad = bedQuad(bed.cells)
            const unlocked = unlockedBedIds.has(bed.id)
            // Empty second halves can occur for a one-character source list.
            // A locked bed remains visibly overgrown until the player reaches it.
            const infection = unlocked ? bedInfection(bed, save.cards) : 1
            return (
              <button
                className={`bed-hotspot ${unlocked ? 'is-unlocked' : 'is-locked'} ${lockedPulseId === bed.id ? 'is-locked-pulse' : ''}`}
                key={bed.id}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  clipPath: bedClipPath(quad),
                }}
                data-bed-id={bed.id}
                onClick={() => activateBed(bed)}
                aria-label={`Грядка ${bed.id}, зарастание ${Math.ceil(infection * 10)} из 10${unlocked ? '' : ', путь закрыт'}`}
              >
                {!unlocked && <LockKeyhole className="bed-lock" />}
              </button>
            )
          })}
        </div>
        {debugMap && <MapDebugOverlay />}
      </div>
      {loadState !== 'ready' && (
        <div className={`map-loading-screen ${loadState === 'error' ? 'has-error' : ''}`} role={loadState === 'error' ? 'alert' : 'status'}>
          <Leaf size={30} aria-hidden="true" />
          {loadState === 'loading' ? (
            <span>Заходим в сад…</span>
          ) : (
            <>
              <span>Не удалось проявить карту</span>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setLoadState('loading')
                  setLoadAttempt((attempt) => attempt + 1)
                }}
              >
                Повторить
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
