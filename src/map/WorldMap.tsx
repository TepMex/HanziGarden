import { useCallback, useEffect, useRef, useState } from 'react'
import { Leaf, LockKeyhole } from 'lucide-react'
import { assetUrl } from '../assetUrl'
import { plots, type PlotDefinition } from '../data/model'
import { cellQuad, gardenRegions, plotBounds, plotQuad, quadPoint, WORLD_HEIGHT, WORLD_WIDTH, type NormalizedPoint, type NormalizedQuad } from '../data/mapLayout'
import type { SaveGame } from '../db'
import { plotInfection } from '../garden'
import {
  baseMapScale,
  cameraForWorldPoint,
  clampCamera,
  clampZoom,
  mobileCameraForWorldBounds,
  type CameraState,
  type Point,
  type Viewport,
  zoomAroundPoint,
} from './cameraMath'
import { GardenRevealCanvas } from './GardenRevealCanvas'

type WorldMapProps = {
  save: SaveGame
  camera: CameraState
  focusPlotId: string | null
  gridVisible: boolean
  onCameraChange: (camera: CameraState) => void
  onEnterPlot: (plot: PlotDefinition) => void
}

type Drag = { pointerId: number; point: Point; camera: CameraState }
type Pinch = { distance: number; worldPoint: Point; camera: CameraState }
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

function rectToWorld(rect: { x: number; y: number; width: number; height: number }) {
  return { x: rect.x * WORLD_WIDTH, y: rect.y * WORLD_HEIGHT, width: rect.width * WORLD_WIDTH, height: rect.height * WORLD_HEIGHT }
}

function quadPoints(quad: NormalizedQuad): string {
  return [
    quad.tl, quad.tr, quad.br, quad.bl,
  ].map((point) => `${point.x * WORLD_WIDTH},${point.y * WORLD_HEIGHT}`).join(' ')
}

function worldPoint(point: NormalizedPoint): { x: number; y: number } {
  return { x: point.x * WORLD_WIDTH, y: point.y * WORLD_HEIGHT }
}

function FineGridOverlay() {
  return (
    <svg className="world-map-cell-grid" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} aria-hidden="true">
      {gardenRegions.flatMap((region) => {
        const columns = region.index === 0 ? 2 : 3
        const verticalLines = Array.from({ length: columns - 1 }, (_, index) => {
          const amount = (index + 1) / columns
          const start = worldPoint(quadPoint(region.mapQuad, amount, 0))
          const end = worldPoint(quadPoint(region.mapQuad, amount, 1))
          return <line key={`${region.id}:column:${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        })
        const horizontalLines = Array.from({ length: 4 }, (_, index) => {
          const amount = (index + 1) / 5
          const start = worldPoint(quadPoint(region.mapQuad, 0, amount))
          const end = worldPoint(quadPoint(region.mapQuad, 1, amount))
          return <line key={`${region.id}:row:${index}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        })
        return [...verticalLines, ...horizontalLines]
      })}
    </svg>
  )
}

function plotClipPath(quad: NormalizedQuad): string {
  const bounds = plotBoundsFromQuad(quad)
  const points = [quad.tl, quad.tr, quad.br, quad.bl].map((point) => {
    const x = (point.x - bounds.x) / bounds.width * 100
    const y = (point.y - bounds.y) / bounds.height * 100
    return `${x}% ${y}%`
  })
  return `polygon(${points.join(', ')})`
}

function plotBoundsFromQuad(quad: NormalizedQuad) {
  const xs = [quad.tl.x, quad.tr.x, quad.bl.x, quad.br.x]
  const ys = [quad.tl.y, quad.tr.y, quad.bl.y, quad.br.y]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function MapDebugOverlay() {
  return (
    <svg className="map-debug-overlay" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} aria-hidden="true">
      {gardenRegions.map((region) => (
        <polygon key={region.id} points={quadPoints(region.mapQuad)} className="debug-region" />
      ))}
      {plots.flatMap((plot) => plot.cells.map((cell) => (
        <polygon key={`${plot.id}:${cell.x}:${cell.y}`} points={quadPoints(cellQuad(cell))} className="debug-cell" />
      )))}
      {plots.map((plot) => {
        const rect = rectToWorld(plotBounds(plot.cells))
        return (
          <g key={plot.id}>
            <polygon points={quadPoints(plotQuad(plot.cells))} className="debug-plot" />
            <text x={rect.x + 5} y={rect.y + 15}>{plot.id}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** A transformed world. Weed mask re-renders only for save changes, never for camera movement. */
export function WorldMap({ save, camera, focusPlotId, gridVisible, onCameraChange, onEnterPlot }: WorldMapProps) {
  const viewportRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef(camera)
  const pointersRef = useRef(new Map<number, Point>())
  const dragRef = useRef<Drag | null>(null)
  const pinchRef = useRef<Pinch | null>(null)
  const movedRef = useRef(false)
  const wheelCommitRef = useRef<number | null>(null)
  const [lockedPulseId, setLockedPulseId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<MapLoadState>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const revealReady = useCallback(() => setLoadState('ready'), [])
  const revealFailed = useCallback(() => setLoadState('error'), [])

  const getViewport = useCallback((): Viewport | null => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return rect ? { width: rect.width, height: rect.height } : null
  }, [])

  const paintCamera = useCallback((next: CameraState, transition = false): CameraState | null => {
    const viewport = getViewport()
    const world = worldRef.current
    if (!viewport || !world) return null
    const clamped = clampCamera(next, viewport)
    cameraRef.current = clamped
    world.style.transition = transition ? 'transform 360ms cubic-bezier(.2,.75,.2,1)' : 'none'
    world.style.transform = `translate3d(${viewport.width / 2 + clamped.x}px, ${viewport.height / 2 + clamped.y}px, 0) scale(${baseMapScale(viewport) * clamped.zoom}) translate3d(-${WORLD_WIDTH / 2}px, -${WORLD_HEIGHT / 2}px, 0)`
    return clamped
  }, [getViewport])

  const commitCamera = useCallback(() => onCameraChange(cameraRef.current), [onCameraChange])

  useEffect(() => {
    paintCamera(camera)
  }, [camera, paintCamera])

  useEffect(() => {
    const viewport = getViewport()
    const plot = plots.find((candidate) => candidate.id === focusPlotId)
    if (!viewport || !plot) return
    const bounds = rectToWorld(plotBounds(plot.cells))
    const focused = mobileCameraForWorldBounds(bounds, viewport, 0.1)
    if (!focused) return
    const painted = paintCamera(focused, true)
    if (painted) onCameraChange(painted)
  }, [focusPlotId, getViewport, onCameraChange, paintCamera])

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
      const targetZoom = clampZoom(cameraRef.current.zoom * Math.exp(-event.deltaY * intensity))
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
      worldPoint: {
        x: WORLD_WIDTH / 2 + (center.x - viewport.width / 2 - cameraRef.current.x) / (baseMapScale(viewport) * cameraRef.current.zoom),
        y: WORLD_HEIGHT / 2 + (center.y - viewport.height / 2 - cameraRef.current.y) / (baseMapScale(viewport) * cameraRef.current.zoom),
      },
      camera: cameraRef.current,
    }
    dragRef.current = null
  }

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const viewport = viewportRef.current
    if (!viewport) return
    // Capturing immediately makes mobile browsers send the resulting click to
    // the map container instead of the plot button.  A real drag captures
    // later, after it crosses the gesture threshold.
    if (!(event.target instanceof Element && event.target.closest('.plot-hotspot'))) {
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
      const next = cameraForWorldPoint(pinch.worldPoint, midpoint(pointerValues[0]!, pointerValues[1]!), clampZoom(pinch.camera.zoom * nextDistance / pinch.distance), viewport)
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

  const activatePlot = (plot: PlotDefinition) => {
    if (save.unlockedPlotIds.includes(plot.id)) {
      onEnterPlot(plot)
      return
    }
    setLockedPulseId(plot.id)
    window.setTimeout(() => setLockedPulseId((current) => current === plot.id ? null : current), 500)
  }

  return (
    <section
      className={`world-map-viewport ${loadState === 'error' ? 'has-map-error' : ''}`}
      ref={viewportRef}
      aria-label="Карта сада: перетаскивайте для перемещения, используйте колесо или щипок для масштаба"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    >
      <div className={`world-map-world ${loadState === 'ready' ? 'is-ready' : ''}`} ref={worldRef} aria-hidden={loadState !== 'ready'}>
        <GardenRevealCanvas save={save} loadAttempt={loadAttempt} onReady={revealReady} onError={revealFailed} />
        <div className={`world-map-grid ${gridVisible ? 'is-visible' : ''}`} aria-hidden="true">
          <img className="world-map-grid-source" src={GRID_URL} alt="" draggable={false} />
          <FineGridOverlay />
        </div>
        <div className="world-map-hotspots">
          {plots.map((plot) => {
            const rect = plotBounds(plot.cells)
            const quad = plotQuad(plot.cells)
            const unlocked = save.unlockedPlotIds.includes(plot.id)
            // Empty second halves can occur for a one-character source list.
            // A locked plot remains visibly overgrown until the player reaches it.
            const infection = unlocked ? plotInfection(plot, save.cards) : 1
            return (
              <button
                className={`plot-hotspot ${unlocked ? 'is-unlocked' : 'is-locked'} ${lockedPulseId === plot.id ? 'is-locked-pulse' : ''}`}
                key={plot.id}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  clipPath: plotClipPath(quad),
                }}
                data-plot-id={plot.id}
                onClick={() => activatePlot(plot)}
                aria-label={`Участок ${plot.id}, зарастание ${Math.ceil(infection * 10)} из 10${unlocked ? '' : ', путь закрыт'}`}
              >
                {!unlocked && <LockKeyhole className="plot-lock" />}
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
