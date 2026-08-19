import { useEffect, useRef } from 'react'
import { assetUrl } from '../assetUrl'
import { plots, type PlotDefinition } from '../data/model'
import { cellQuad, plotBounds, WORLD_HEIGHT, WORLD_WIDTH, type NormalizedQuad } from '../data/mapLayout'
import type { SaveGame } from '../db'
import { plotDueFraction, weedCoverageFromDueFraction } from '../garden'
import {
  buildGardenEdgeRasterModel,
  completedGardenRegionIndexes,
  drawGardenEdgeWeedMask,
  extendPlotMaskToRasterGardenEdges,
  type GardenEdgeRasterModel,
} from './gardenEdgeReveal'
import { organicWeedMask } from './weedMask'

type GardenRevealCanvasProps = {
  save: SaveGame
  loadAttempt: number
  onReady: () => void
  onError: () => void
}

const GRID_URL = assetUrl('assets/garden-grid.svg')

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${url}`))
    image.src = url
  })
}

let edgeRasterModelPromise: Promise<GardenEdgeRasterModel> | null = null

function edgeRasterModel(): Promise<GardenEdgeRasterModel> {
  edgeRasterModelPromise ??= loadImage(GRID_URL).then(buildGardenEdgeRasterModel).catch((error: unknown) => {
    edgeRasterModelPromise = null
    throw error
  })
  return edgeRasterModelPromise
}

function traceQuad(context: CanvasRenderingContext2D, quad: NormalizedQuad, offsetX = 0, offsetY = 0): void {
  context.moveTo(quad.tl.x * WORLD_WIDTH - offsetX, quad.tl.y * WORLD_HEIGHT - offsetY)
  context.lineTo(quad.tr.x * WORLD_WIDTH - offsetX, quad.tr.y * WORLD_HEIGHT - offsetY)
  context.lineTo(quad.br.x * WORLD_WIDTH - offsetX, quad.br.y * WORLD_HEIGHT - offsetY)
  context.lineTo(quad.bl.x * WORLD_WIDTH - offsetX, quad.bl.y * WORLD_HEIGHT - offsetY)
  context.closePath()
}

function plotCoverage(plot: PlotDefinition, save: SaveGame): number {
  if (!save.unlockedPlotIds.includes(plot.id)) return 1
  return weedCoverageFromDueFraction(plotDueFraction(plot, save.cards))
}

function drawPartialPlotMask(
  target: CanvasRenderingContext2D,
  plot: PlotDefinition,
  coverage: number,
): void {
  const normalizedBounds = plotBounds(plot.cells)
  const left = Math.floor(normalizedBounds.x * WORLD_WIDTH)
  const top = Math.floor(normalizedBounds.y * WORLD_HEIGHT)
  const right = Math.ceil((normalizedBounds.x + normalizedBounds.width) * WORLD_WIDTH)
  const bottom = Math.ceil((normalizedBounds.y + normalizedBounds.height) * WORLD_HEIGHT)
  const width = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)

  const silhouette = document.createElement('canvas')
  silhouette.width = width
  silhouette.height = height
  const silhouetteContext = silhouette.getContext('2d', { willReadFrequently: true })!
  silhouetteContext.fillStyle = '#fff'
  silhouetteContext.beginPath()
  plot.cells.forEach((cell) => traceQuad(silhouetteContext, cellQuad(cell), left, top))
  silhouetteContext.fill()
  const silhouettePixels = silhouetteContext.getImageData(0, 0, width, height)
  const eligible = new Uint8Array(width * height)
  for (let index = 0; index < eligible.length; index += 1) {
    eligible[index] = silhouettePixels.data[index * 4 + 3]! > 127 ? 1 : 0
  }

  const selected = organicWeedMask(plot.seed, coverage, width, height, eligible)
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const maskContext = mask.getContext('2d')!
  const maskPixels = maskContext.createImageData(width, height)
  for (let index = 0; index < selected.length; index += 1) {
    maskPixels.data[index * 4] = 255
    maskPixels.data[index * 4 + 1] = 255
    maskPixels.data[index * 4 + 2] = 255
    maskPixels.data[index * 4 + 3] = selected[index]!
  }
  maskContext.putImageData(maskPixels, 0, 0)

  const featheredMask = document.createElement('canvas')
  featheredMask.width = width
  featheredMask.height = height
  const featheredContext = featheredMask.getContext('2d')!
  featheredContext.filter = 'blur(1.5px)'
  featheredContext.drawImage(mask, 0, 0)

  target.save()
  target.beginPath()
  plot.cells.forEach((cell) => traceQuad(target, cellQuad(cell)))
  target.clip()
  target.drawImage(featheredMask, left, top)
  target.restore()
}

function drawWeedLayer(
  target: CanvasRenderingContext2D,
  negative: HTMLImageElement,
  save: SaveGame,
  edgeModel: GardenEdgeRasterModel,
): void {
  const coverages = plots.map((plot) => ({ plot, coverage: plotCoverage(plot, save) }))
  const completedRegions = completedGardenRegionIndexes(coverages.map(({ plot, coverage }) => ({
    gardenId: plot.gardenId,
    coverage,
  })))
  const mask = document.createElement('canvas')
  mask.width = WORLD_WIDTH
  mask.height = WORLD_HEIGHT
  const maskContext = mask.getContext('2d', { willReadFrequently: true })!

  drawGardenEdgeWeedMask(maskContext, edgeModel, completedRegions)

  const plotGeometry = document.createElement('canvas')
  plotGeometry.width = WORLD_WIDTH
  plotGeometry.height = WORLD_HEIGHT
  const plotGeometryContext = plotGeometry.getContext('2d', { willReadFrequently: true })!
  plotGeometryContext.fillStyle = '#fff'
  plotGeometryContext.beginPath()
  plots.forEach((plot) => plot.cells.forEach((cell) => traceQuad(plotGeometryContext, cellQuad(cell))))
  plotGeometryContext.fill()

  // Fill all completely overgrown plots as one compound shape. Adjacent plots
  // therefore have no independently antialiased edges that could reveal the
  // clean map as a grid between them.
  maskContext.fillStyle = '#fff'
  maskContext.beginPath()
  coverages.forEach(({ plot, coverage }) => {
    if (coverage < 1) return
    plot.cells.forEach((cell) => traceQuad(maskContext, cellQuad(cell)))
  })
  maskContext.fill()

  coverages.forEach(({ plot, coverage }) => {
    if (coverage > 0 && coverage < 1) drawPartialPlotMask(maskContext, plot, coverage)
  })

  extendPlotMaskToRasterGardenEdges(maskContext, edgeModel, plotGeometry)

  // Scale the negative artwork once into world coordinates, then apply the
  // global mask. Sampling it independently per plot magnifies unrelated source
  // fragments and makes every plot boundary visible.
  const weeds = document.createElement('canvas')
  weeds.width = WORLD_WIDTH
  weeds.height = WORLD_HEIGHT
  const weedsContext = weeds.getContext('2d')!
  weedsContext.drawImage(negative, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  weedsContext.globalCompositeOperation = 'destination-in'
  weedsContext.drawImage(mask, 0, 0)
  target.drawImage(weeds, 0, 0)
}

export function GardenRevealCanvas({ save, loadAttempt, onReady, onError }: GardenRevealCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const suffix = loadAttempt ? `?map-load-attempt=${loadAttempt}` : ''

    void Promise.all([
      loadImage(assetUrl(`assets/garden-map.webp${suffix}`)),
      loadImage(assetUrl(`assets/garden-map_negative.webp${suffix}`)),
      edgeRasterModel(),
    ]).then(([clean, negative, edgeModel]) => {
      if (cancelled) return
      const context = canvas.getContext('2d', { alpha: false })!
      context.globalCompositeOperation = 'source-over'
      context.drawImage(clean, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      drawWeedLayer(context, negative, save, edgeModel)
      window.requestAnimationFrame(() => {
        if (!cancelled) onReady()
      })
    }).catch(() => {
      if (!cancelled) onError()
    })

    return () => { cancelled = true }
  }, [loadAttempt, onError, onReady, save])

  return <canvas className="world-map-canvas" ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} aria-hidden="true" />
}
