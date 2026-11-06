#!/usr/bin/env bun
/** Hex-map regression: shared geometry, real FSRS coverage and reversible saves.
 * Usage: bun scripts/check-garden-mask-alignment.mjs [baseUrl]
 * Uses the game-cheats skill/API; no direct IndexedDB edits.
 */
import { chromium } from 'playwright'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Войти в сад/i }).click()
  await page.waitForSelector('.garden-map-content.is-ready')
  const backup = await page.evaluate(() => window.hanziGardenCheats.dumpDb())
  try {
    const geometry = await page.evaluate(async () => {
      const { gardenHexes, hexBounds } = await import('/src/map/hexGardenLayout.ts')
      const targets = [...document.querySelectorAll('.bed-hotspot')]
      if (targets.length !== 220) throw Error(`Expected 220 targets, received ${targets.length}`)
      for (const hex of gardenHexes) {
        const target = targets.find((node) => node.dataset.bedId === hex.id)
        if (!target) throw Error(`Missing target ${hex.id}`)
        const bounds = hexBounds(hex)
        for (const [css, key] of [['left', 'x'], ['top', 'y'], ['width', 'width'], ['height', 'height']]) {
          if (Math.abs(Number.parseFloat(target.style[css]) / 100 - bounds[key]) > 1e-6) throw Error(`Misaligned ${hex.id}: ${css}`)
        }
        if (!target.style.clipPath.startsWith('polygon(')) throw Error(`Missing hex hit shape: ${hex.id}`)
      }
      return targets.length
    })
    const setState = async (clean) => {
      await page.evaluate(async (clean) => {
        const [{ beds }, { reviewCard }] = await Promise.all([import('/src/data/model.ts'), import('/src/learning.ts')])
        const save = await window.hanziGardenCheats.dumpDb('object')
        save.unlockedBedIds = beds.map((bed) => bed.id)
        save.cards = {}
        if (clean) for (const bed of beds) for (const character of bed.characters) save.cards[character.id] = reviewCard(undefined, 0, false, new Date('2099-01-01')).card
        await window.hanziGardenCheats.loadDb(save)
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      }, clean)
      // Wait for asset loading as well as the new save's canvas paint.
      await page.waitForSelector('.garden-map-content.is-ready')
      return page.evaluate(() => {
        const canvas = document.querySelector('.garden-map-canvas')
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        let luminance = 0
        for (let i = 0; i < data.length; i += 4) luminance += data[i] + data[i + 1] + data[i + 2]
        return luminance
      })
    }
    const dirty = await setState(false)
    const clean = await setState(true)
    if (clean <= dirty * 1.2) throw Error(`FSRS health did not change visible terrain and plants: ${dirty} -> ${clean}`)
    await page.getByRole('button', { name: 'Показать сетку', exact: true }).click()
    if (await page.locator('.garden-map-cell-grid polygon').count() !== 220) throw Error('Hex grid is incomplete')
    await setState(false)
    await page.locator('.bed-hotspot[data-bed-id="bed-001"]').press('Enter')
    await page.waitForSelector('.battle-screen')
    console.log(`OK: ${geometry} aligned hex targets, FSRS-driven art, grid and bed entry`)
  } finally {
    await page.evaluate((backup) => window.hanziGardenCheats.loadDb(backup), backup)
  }
  await context.close()
} finally {
  await browser.close()
}
