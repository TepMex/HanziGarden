#!/usr/bin/env bun
import { chromium } from 'playwright'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
]

async function seedSave(page) {
  await page.evaluate(async () => {
    sessionStorage.setItem('memory-garden-welcomed', 'yes')
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('memory-garden')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('saves', 'readwrite')
      transaction.objectStore('saves').put({
        id: 'main', version: 3, unlockedPlotIds: ['plot-001'], masteredPlotIds: [],
        lastActivePlotId: 'plot-001', seenCharacterIds: [], cards: {}, reviewEvents: [], updatedAt: Date.now(),
      })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
}

const browser = await chromium.launch({ headless: true })
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Войти в сад/i }).waitFor()
    await seedSave(page)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.world-map-world.is-ready')

    const map = await page.evaluate(() => {
      const gridButton = document.querySelector('.map-grid-button')
      const statsLabel = document.querySelector('.map-stats-button span')
      const plot = document.querySelector('[data-plot-id="plot-001"]')?.getBoundingClientRect()
      return {
        gridText: gridButton?.textContent?.trim(),
        gridChildTags: [...(gridButton?.children ?? [])].map((element) => element.tagName),
        statsLabelDisplay: statsLabel ? getComputedStyle(statsLabel).display : null,
        headerText: document.querySelector('.map-header')?.textContent ?? '',
        plot: plot ? { left: plot.left, right: plot.right } : null,
      }
    })
    const tolerance = 3
    if (map.gridText || map.gridChildTags.join() !== 'svg' || map.statsLabelDisplay !== 'none') {
      throw new Error(`mobile buttons are not icon-only: ${JSON.stringify({ viewport, map })}`)
    }
    if (/изучено|на повторение/i.test(map.headerText)) throw new Error('removed counters are visible')
    if (!map.plot || Math.abs(map.plot.left - viewport.width * 0.1) > tolerance || Math.abs(map.plot.right - viewport.width * 0.9) > tolerance) {
      throw new Error(`plot autofocus margin failed: ${JSON.stringify({ viewport, plot: map.plot })}`)
    }

    const mapViewport = page.locator('.world-map-viewport')
    const box = await mapViewport.boundingBox()
    if (!box) throw new Error('missing map viewport')
    await page.mouse.move(box.width * 0.4, box.height * 0.55)
    await page.mouse.down()
    await page.mouse.move(box.width * 0.6, box.height * 0.58, { steps: 4 })
    await page.mouse.up()
    if (await page.locator('.world-map-grid.is-visible').count()) throw new Error('drag enabled the grid')

    await page.getByRole('button', { name: 'Показать сетку' }).click()
    if (!await page.locator('.world-map-grid.is-visible').count()) throw new Error('grid button did not enable the grid')
    if (await page.locator('.map-grid-button').getAttribute('aria-pressed') !== 'true') throw new Error('grid pressed state missing')
    await page.getByRole('button', { name: 'Скрыть сетку' }).click()

    await page.locator('[data-plot-id="plot-001"]').click({ force: true })
    await page.waitForSelector('.writing-target svg')
    const battle = await page.evaluate(() => {
      const circle = document.querySelector('.writing-circle')?.getBoundingClientRect()
      const target = document.querySelector('.writing-target')?.getBoundingClientRect()
      const prompt = document.querySelector('.prompt-scroll')?.getBoundingClientRect()
      return {
        ratio: circle && target ? target.width / document.querySelector('.writing-circle').clientWidth : null,
        targetInside: Boolean(circle && target && target.left >= circle.left && target.right <= circle.right && target.top >= circle.top && target.bottom <= circle.bottom),
        intersects: Boolean(circle && prompt && !(prompt.right <= circle.left || prompt.left >= circle.right || prompt.bottom <= circle.top || prompt.top >= circle.bottom)),
        removed: ['.weed-core', '.battle-progress', '.stroke-feedback'].some((selector) => document.querySelector(selector)),
        copy: document.querySelector('.battle-screen')?.textContent ?? '',
      }
    })
    if (battle.ratio === null || Math.abs(battle.ratio - 0.7071) > 0.005 || !battle.targetInside || battle.intersects) {
      throw new Error(`writer geometry failed: ${JSON.stringify({ viewport, battle })}`)
    }
    if (battle.removed || /Целевое значение|Примитив/i.test(battle.copy)) throw new Error('removed battle UI is visible')
    await page.locator('.hint-button').click()
    await page.waitForTimeout(500)
    if (await page.locator('.writing-target svg path').count() < 1) throw new Error('hint stopped working')
    await context.close()
  }
  console.log('OK: improvements 19082026 mobile map and battle regressions')
} finally {
  await browser.close()
}
