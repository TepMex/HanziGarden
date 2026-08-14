import { useCallback, useEffect, useRef, useState } from 'react'
import { Leaf, LockKeyhole } from 'lucide-react'
import { assetUrl } from '../assetUrl'
import { plots, type PlotDefinition } from '../data/model'
import { cellRect, gardenRegions, plotBounds, WORLD_HEIGHT, WORLD_WIDTH, type NormalizedQuad } from '../data/mapLayout'
import type { SaveGame } from '../db'
import { plotInfection } from '../garden'
import {
  cornerGardenClearedFraction,
  cornerGardenExteriorRevealEllipses,
  type CornerGarden,
} from './cornerGardenReveal'
import {
  clearedFromInfection,
  plotRevealEllipses,
  plotRevealQuads,
  type RevealEllipse,
} from './plotReveal'
import {
  baseMapScale,
  cameraForWorldPoint,
  clampCamera,
  clampZoom,
  type CameraState,
  type Point,
  type Viewport,
  zoomAroundPoint,
} from './cameraMath'

type WorldMapProps = {
  save: SaveGame
  camera: CameraState
  onCameraChange: (camera: CameraState) => void
  onEnterPlot: (plot: PlotDefinition) => void
}

type Drag = { pointerId: number; point: Point; camera: CameraState }
type Pinch = { distance: number; worldPoint: Point; camera: CameraState }
type MapLoadState = 'loading' | 'ready' | 'error'

const debugMap = new URLSearchParams(window.location.search).get('debugMap') === '1'
const DRAG_THRESHOLD = 12

async function loadAndDecodeImage(url: string): Promise<void> {
  const image = new Image()
  image.src = url

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Could not load ${url}`))
    // Cached browser images can already be complete before the handlers above
    // run.  A zero natural width still means a failed resource.
    if (image.complete) {
      if (image.naturalWidth > 0) resolve()
      else reject(new Error(`Could not load ${url}`))
    }
  })

  // decode() waits for pixels, rather than merely the network response.
  if ('decode' in image) await image.decode()
}

/** Resolve after `count` animation frames so the covered map can composite. */
function waitPaintFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      window.requestAnimationFrame(() => step(left - 1))
    }
    step(count)
  })
}

/**
 * Wait until the SVG weed <image> has bound its href.  Cached resources may
 * skip a second load event, so we also accept a successful HTML Image decode
 * of the same URL after giving the SVG element one frame to attach.
 */
async function waitForSvgWeedLayer(image: SVGImageElement, url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const succeed = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const fail = (error?: unknown) => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error('Could not load SVG map layer'))
    }

    image.addEventListener('load', succeed, { once: true })
    image.addEventListener('error', () => fail(new Error(`Could not load ${url}`)), { once: true })

    void loadAndDecodeImage(url).then(() => {
      // One frame for the SVG <image> to adopt the already-decoded resource.
      window.requestAnimationFrame(() => succeed())
    }, fail)
  })
}

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

function ellipseToWorld(ellipse: RevealEllipse): RevealEllipse {
  return {
    centerX: ellipse.centerX * WORLD_WIDTH,
    centerY: ellipse.centerY * WORLD_HEIGHT,
    radiusX: ellipse.radiusX * WORLD_WIDTH,
    radiusY: ellipse.radiusY * WORLD_HEIGHT,
    rotation: ellipse.rotation,
  }
}

const cornerGardens: Array<{ regionIndex: number; corner: CornerGarden }> = [
  { regionIndex: 0, corner: 'top-left' },
  { regionIndex: 4, corner: 'top-right' },
  { regionIndex: 10, corner: 'bottom-left' },
  { regionIndex: 14, corner: 'bottom-right' },
]

function plotInfectionForSave(plot: PlotDefinition, save: SaveGame): number {
  return save.unlockedPlotIds.includes(plot.id) ? plotInfection(plot, save.cards) : 1
}

function cornerExteriorRevealEllipses(save: SaveGame): RevealEllipse[] {
  return cornerGardens.flatMap(({ regionIndex, corner }) => {
    const region = gardenRegions[regionIndex]!
    const regionPlots = plots.filter((plot) => plot.gardenId === region.id)
    const cleared = cornerGardenClearedFraction(
      regionPlots.map((plot) => ({
        characterCount: plot.characters.length,
        cleared: clearedFromInfection(plotInfectionForSave(plot, save)),
      })),
    )
    return cornerGardenExteriorRevealEllipses(region, corner, cleared).map(ellipseToWorld)
  })
}

function quadPoints(quad: NormalizedQuad): string {
  return [
    quad.tl, quad.tr, quad.br, quad.bl,
  ].map((point) => `${point.x * WORLD_WIDTH},${point.y * WORLD_HEIGHT}`).join(' ')
}

function MapDebugOverlay() {
  return (
    <svg className="map-debug-overlay" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} aria-hidden="true">
      {gardenRegions.map((region) => (
        <polygon key={region.id} points={quadPoints(region.mapQuad)} className="debug-region" />
      ))}
      {plots.flatMap((plot) => plot.cells.map((cell) => {
        const rect = rectToWorld(cellRect(cell))
        return <rect key={`${plot.id}:${cell.x}:${cell.y}`} {...rect} className="debug-cell" />
      }))}
      {plots.map((plot) => {
        const rect = rectToWorld(plotBounds(plot.cells))
        return (
          <g key={plot.id}>
            <rect {...rect} className="debug-plot" />
            <text x={rect.x + 5} y={rect.y + 15}>{plot.id}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** A transformed world. Weed mask re-renders only for save changes, never for camera movement. */
export function WorldMap({ save, camera, onCameraChange, onEnterPlot }: WorldMapProps) {
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
  const weedImageRef = useRef<SVGImageElement>(null)
  const cleanMapUrl = assetUrl(`assets/garden-map.webp${loadAttempt ? `?map-load-attempt=${loadAttempt}` : ''}`)
  const negativeMapUrl = assetUrl(`assets/garden-map_negative.webp${loadAttempt ? `?map-load-attempt=${loadAttempt}` : ''}`)

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

  useEffect(() => {
    let cancelled = false

    setLoadState('loading')
    // Keep the opaque preloader up while the world paints underneath.  Hiding
    // the world with visibility:hidden skipped SVG compositing, so removing the
    // preloader exposed a clean plate for a frame before the weed layer caught up.
    void (async () => {
      try {
        await Promise.all([loadAndDecodeImage(cleanMapUrl), loadAndDecodeImage(negativeMapUrl)])
        if (cancelled) return
        const weedImage = weedImageRef.current
        if (weedImage) await waitForSvgWeedLayer(weedImage, negativeMapUrl)
        if (cancelled) return
        // Extra frames after the SVG <image> reports ready: mask + blend still
        // lag the HTML clean plate on some Android WebViews.
        await waitPaintFrames(3)
        if (!cancelled) setLoadState('ready')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cleanMapUrl, negativeMapUrl])

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
        <img className="world-map-clean" src={cleanMapUrl} alt="" draggable={false} />
        <svg className="world-map-weed" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} aria-hidden="true">
          <defs>
            <radialGradient id="world-weed-reveal" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="black" />
              <stop offset="68%" stopColor="black" />
              <stop offset="86%" stopColor="black" stopOpacity=".55" />
              <stop offset="100%" stopColor="black" stopOpacity="0" />
            </radialGradient>
            <mask id="world-weed-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
              <rect width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="white" />
              {/* Soft ellipses only — no hard exterior rects, no mix-blend multiply.
                  Android WebViews turned multiply + axis-aligned rects into bright seams. */}
              {cornerExteriorRevealEllipses(save).map((ellipse, index) => (
                <ellipse
                  key={`corner-exterior:${index}`}
                  cx="0"
                  cy="0"
                  rx="1"
                  ry="1"
                  fill="url(#world-weed-reveal)"
                  transform={`translate(${ellipse.centerX} ${ellipse.centerY}) rotate(${ellipse.rotation * 180 / Math.PI}) scale(${ellipse.radiusX} ${ellipse.radiusY})`}
                />
              ))}
              {plots.flatMap((plot) => {
                const infection = plotInfectionForSave(plot, save)
                const quads = plotRevealQuads(plot.cells, infection)
                const ellipses = plotRevealEllipses(plot.cells, plot.seed, infection).map(ellipseToWorld)
                return [
                  ...quads.map((quad, index) => (
                    <polygon
                      key={`${plot.id}:quad:${index}`}
                      points={quadPoints(quad)}
                      fill="black"
                    />
                  )),
                  ...ellipses.map((ellipse, index) => (
                    <ellipse
                      key={`${plot.id}:ellipse:${index}`}
                      cx="0"
                      cy="0"
                      rx="1"
                      ry="1"
                      fill="url(#world-weed-reveal)"
                      transform={`translate(${ellipse.centerX} ${ellipse.centerY}) rotate(${ellipse.rotation * 180 / Math.PI}) scale(${ellipse.radiusX} ${ellipse.radiusY})`}
                    />
                  )),
                ]
              })}
            </mask>
          </defs>
          <image ref={weedImageRef} href={negativeMapUrl} width={WORLD_WIDTH} height={WORLD_HEIGHT} preserveAspectRatio="none" mask="url(#world-weed-mask)" />
        </svg>
        <div className="world-map-hotspots">
          {plots.map((plot) => {
            const rect = plotBounds(plot.cells)
            const unlocked = save.unlockedPlotIds.includes(plot.id)
            // Empty second halves can occur for a one-character source list.
            // A locked plot remains visibly overgrown until the player reaches it.
            const infection = unlocked ? plotInfection(plot, save.cards) : 1
            return (
              <button
                className={`plot-hotspot ${unlocked ? 'is-unlocked' : 'is-locked'} ${lockedPulseId === plot.id ? 'is-locked-pulse' : ''}`}
                key={plot.id}
                style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}
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
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
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
