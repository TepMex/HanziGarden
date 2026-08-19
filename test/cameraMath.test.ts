import { describe, expect, test } from 'bun:test'
import { cameraForGardenBounds, clampCamera, clampZoom, mobileCameraForGardenBounds, screenToGarden, gardenToScreen, zoomAroundPoint } from '../src/map/cameraMath'
import { GARDEN_HEIGHT, GARDEN_WIDTH, automaticFocusBoundsForCells, biomes } from '../src/data/mapLayout'

const viewport = { width: 1000, height: 800 }

describe('garden camera math', () => {
  test('clamps zoom to supported limits', () => {
    expect(clampZoom(-2)).toBe(1)
    expect(clampZoom(50)).toBe(12)
  })

  test.each([
    { width: 390, height: 844 },
    { width: 1280, height: 720 },
  ])('stops zooming out when the first pair of garden edges reaches the viewport in $width × $height', (viewport) => {
    const camera = clampCamera({ x: 0, y: 0, zoom: 0 }, viewport)
    const renderedWidth = GARDEN_WIDTH * camera.zoom * Math.min(viewport.width / GARDEN_WIDTH, viewport.height / GARDEN_HEIGHT)
    const renderedHeight = GARDEN_HEIGHT * camera.zoom * Math.min(viewport.width / GARDEN_WIDTH, viewport.height / GARDEN_HEIGHT)

    expect(renderedWidth).toBeGreaterThanOrEqual(viewport.width)
    expect(renderedHeight).toBeGreaterThanOrEqual(viewport.height)
    expect(Math.min(renderedWidth - viewport.width, renderedHeight - viewport.height)).toBeCloseTo(0)
  })

  test('never reveals a side edge while panning at minimum zoom on a portrait viewport', () => {
    const portrait = { width: 375, height: 667 }

    for (const x of [-999999, 999999]) {
      const camera = clampCamera({ x, y: 0, zoom: 0 }, portrait)
      const left = gardenToScreen({ x: 0, y: GARDEN_HEIGHT / 2 }, camera, portrait)
      const right = gardenToScreen({ x: GARDEN_WIDTH, y: GARDEN_HEIGHT / 2 }, camera, portrait)
      expect(left.x).toBeLessThanOrEqual(0)
      expect(right.x).toBeGreaterThanOrEqual(portrait.width)
    }
  })

  test('never reveals a top or bottom edge while panning at minimum zoom on a landscape viewport', () => {
    const landscape = { width: 1280, height: 720 }

    for (const y of [-999999, 999999]) {
      const camera = clampCamera({ x: 0, y, zoom: 0 }, landscape)
      const top = gardenToScreen({ x: GARDEN_WIDTH / 2, y: 0 }, camera, landscape)
      const bottom = gardenToScreen({ x: GARDEN_WIDTH / 2, y: GARDEN_HEIGHT }, camera, landscape)
      expect(top.y).toBeLessThanOrEqual(0)
      expect(bottom.y).toBeGreaterThanOrEqual(landscape.height)
    }
  })

  test('resolves the containing biome bounds for automatic bed focus', () => {
    expect(automaticFocusBoundsForCells([{ x: 2, y: 4 }])).toEqual(biomes[0]!.mapRect)
    expect(automaticFocusBoundsForCells([{ x: 3, y: 0 }])).toEqual(biomes[1]!.mapRect)
  })

  test('keeps the garden point under the cursor when zooming', () => {
    const camera = { x: 50, y: -20, zoom: 2 }
    const cursor = { x: 713, y: 169 }
    const before = screenToGarden(cursor, camera, viewport)
    const after = screenToGarden(cursor, zoomAroundPoint(camera, cursor, 5, viewport), viewport)
    expect(after.x).toBeCloseTo(before.x, 8)
    expect(after.y).toBeCloseTo(before.y, 8)
  })

  test('converts coordinates round-trip and constrains a lost camera', () => {
    const camera = { x: 82, y: -31, zoom: 3 }
    const point = { x: 400, y: 720 }
    expect(screenToGarden(gardenToScreen(point, camera, viewport), camera, viewport)).toEqual(point)
    const clamped = clampCamera({ x: 999999, y: -999999, zoom: 3 }, viewport)
    expect(Math.abs(clamped.x)).toBeLessThan(3000)
    expect(Math.abs(clamped.y)).toBeLessThan(3000)
  })

  test('centers bed bounds and keeps ten percent horizontal margins', () => {
    const mobile = { width: 390, height: 844 }
    const bounds = { x: 300, y: 250, width: 240, height: 100 }
    const camera = cameraForGardenBounds(bounds, mobile, 0.1)
    const left = gardenToScreen({ x: bounds.x, y: bounds.y + bounds.height / 2 }, camera, mobile)
    const right = gardenToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, camera, mobile)
    expect((left.x + right.x) / 2).toBeCloseTo(mobile.width / 2)
    expect(left.x).toBeCloseTo(mobile.width * 0.1)
    expect(right.x).toBeCloseTo(mobile.width * 0.9)
    expect(camera.zoom).toBeGreaterThanOrEqual(1)
    expect(camera.zoom).toBeLessThanOrEqual(12)
  })

  test('does not generate an automatic desktop focus', () => {
    expect(mobileCameraForGardenBounds({ x: 0, y: 0, width: 100, height: 100 }, viewport)).toBeNull()
  })
})
