#!/usr/bin/env bun
/**
 * Regression: fully overgrown beds must sample the negative artwork from the
 * same garden coordinates as the clean map. Otherwise each bed looks like a
 * magnified tile and the bed boundaries read as a permanently visible grid.
 *
 * Usage: bun scripts/check-garden-mask-alignment.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')
const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  page.setDefaultTimeout(8_000)
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Войти в сад/i }).click()
  await page.waitForSelector('.garden-map-content.is-ready')

  const result = await page.evaluate(async () => {
    const actual = document.querySelector('.garden-map-canvas')
    if (!(actual instanceof HTMLCanvasElement)) throw new Error('missing garden canvas')
    const actualContext = actual.getContext('2d')
    if (!actualContext) throw new Error('missing garden canvas context')

    const negative = new Image()
    negative.src = '/assets/garden-map_negative.webp'
    await negative.decode()
    const expected = document.createElement('canvas')
    expected.width = actual.width
    expected.height = actual.height
    const expectedContext = expected.getContext('2d')
    if (!expectedContext) throw new Error('missing reference canvas context')
    expectedContext.drawImage(negative, 0, 0, expected.width, expected.height)

    const meanPixelError = (centerX, centerY, radius = 2) => {
      let error = 0
      let channels = 0
      for (let y = centerY - radius; y <= centerY + radius; y += 1) {
        for (let x = centerX - radius; x <= centerX + radius; x += 1) {
          const actualPixel = actualContext.getImageData(x, y, 1, 1).data
          const expectedPixel = expectedContext.getImageData(x, y, 1, 1).data
          for (let channel = 0; channel < 3; channel += 1) {
            error += Math.abs(actualPixel[channel] - expectedPixel[channel])
            channels += 1
          }
        }
      }
      return error / channels
    }

    const regressionBedIds = new Set(['bed-043', 'bed-044'])
    const samples = [...document.querySelectorAll('.bed-hotspot.is-locked')]
      .filter((hotspot) => regressionBedIds.has(hotspot.dataset.bedId ?? ''))
      .map((hotspot) => {
        if (!(hotspot instanceof HTMLElement)) throw new Error('invalid bed hotspot')
        const centerX = Math.round(Number.parseFloat(hotspot.style.left) * actual.width / 100
          + Number.parseFloat(hotspot.style.width) * actual.width / 200)
        const centerY = Math.round(Number.parseFloat(hotspot.style.top) * actual.height / 100
          + Number.parseFloat(hotspot.style.height) * actual.height / 200)
        return { id: hotspot.dataset.bedId, meanError: meanPixelError(centerX, centerY) }
      })

    const [{ beds }, { biomes, bedQuad }, { buildGardenEdgeRasterModel }] = await Promise.all([
      import('/src/data/model.ts'),
      import('/src/data/mapLayout.ts'),
      import('/src/map/gardenEdgeReveal.ts'),
    ])
    const grid = new Image()
    grid.src = '/assets/garden-grid.svg'
    await grid.decode()
    const edgeModel = buildGardenEdgeRasterModel(grid)
    const edgeBiomeLabels = new Set(edgeModel.biomeLabels)
    const leftBed = beds.find((bed) => bed.id === 'bed-042')
    if (!leftBed) throw new Error('missing seam regression bed')
    const leftQuad = bedQuad(leftBed.cells)
    const seamX = Math.round((leftQuad.tr.x + leftQuad.br.x) * actual.width / 2)
    const seamY = Math.round((leftQuad.tr.y + leftQuad.br.y) * actual.height / 2)
    const seamError = meanPixelError(seamX, seamY, 3)
    const coveredEdgeError = meanPixelError(actual.width / 2, 40, 3)

    // The fourth garden is entirely locked in the initial save. Compare its
    // whole outer quadrilateral, including every internal bed boundary, with
    // the globally scaled negative artwork.
    const biome = biomes[3]
    if (!biome) throw new Error('missing biome regression fixture')
    const biomeMask = document.createElement('canvas')
    biomeMask.width = actual.width
    biomeMask.height = actual.height
    const biomeContext = biomeMask.getContext('2d')
    if (!biomeContext) throw new Error('missing biome mask context')
    biomeContext.fillStyle = '#fff'
    biomeContext.beginPath()
    biomeContext.moveTo(biome.mapQuad.tl.x * actual.width, biome.mapQuad.tl.y * actual.height)
    biomeContext.lineTo(biome.mapQuad.tr.x * actual.width, biome.mapQuad.tr.y * actual.height)
    biomeContext.lineTo(biome.mapQuad.br.x * actual.width, biome.mapQuad.br.y * actual.height)
    biomeContext.lineTo(biome.mapQuad.bl.x * actual.width, biome.mapQuad.bl.y * actual.height)
    biomeContext.closePath()
    biomeContext.fill()
    const biomeAlpha = biomeContext.getImageData(0, 0, actual.width, actual.height).data
    const actualPixels = actualContext.getImageData(0, 0, actual.width, actual.height).data
    const expectedPixels = expectedContext.getImageData(0, 0, actual.width, actual.height).data
    let biomePixels = 0
    let mismatchedBiomePixels = 0
    let mismatchedCanvasPixels = 0
    const mismatchKinds = { biome: 0, line: 0, exterior: 0 }
    const mismatchBounds = { left: actual.width, top: actual.height, right: 0, bottom: 0 }
    for (let index = 0; index < actual.width * actual.height; index += 1) {
      let pixelError = 0
      for (let channel = 0; channel < 3; channel += 1) {
        pixelError += Math.abs(actualPixels[index * 4 + channel] - expectedPixels[index * 4 + channel])
      }
      const mismatched = pixelError / 3 > 2
      if (mismatched) {
        mismatchedCanvasPixels += 1
        const label = edgeModel.labels[index]
        if (label < 0) mismatchKinds.line += 1
        else if (edgeBiomeLabels.has(label)) mismatchKinds.biome += 1
        else mismatchKinds.exterior += 1
        const x = index % actual.width
        const y = Math.floor(index / actual.width)
        mismatchBounds.left = Math.min(mismatchBounds.left, x)
        mismatchBounds.top = Math.min(mismatchBounds.top, y)
        mismatchBounds.right = Math.max(mismatchBounds.right, x)
        mismatchBounds.bottom = Math.max(mismatchBounds.bottom, y)
      }
      if (biomeAlpha[index * 4 + 3] !== 255) continue
      biomePixels += 1
      if (mismatched) mismatchedBiomePixels += 1
    }
    const biomeMismatch = mismatchedBiomePixels / biomePixels
    return {
      sampleCount: samples.length,
      meanError: samples.reduce((sum, sample) => sum + sample.meanError, 0) / samples.length,
      worst: samples.toSorted((left, right) => right.meanError - left.meanError)[0],
      seamError,
      coveredEdgeError,
      biomeMismatch,
      mismatchedCanvasPixels,
      mismatchBounds,
      mismatchKinds,
    }
  })

  if (result.sampleCount < 2 || result.meanError > 2 || result.seamError > 2
    || result.coveredEdgeError > 2 || result.biomeMismatch > 0.001 || result.mismatchedCanvasPixels > 0) {
    throw new Error(`negative artwork is not aligned to garden coordinates: ${JSON.stringify(result)}`)
  }

  console.log(`OK: negative artwork aligns across ${result.sampleCount} beds, has no tile seams, and keeps unearned edges covered`)
  await context.close()
} finally {
  await browser.close()
}
