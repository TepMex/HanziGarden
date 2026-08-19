#!/usr/bin/env bun
/**
 * Regression: the clean world must never be exposed while the negative image
 * layer is still loading.  Also check the recoverable error state.
 *
 * Usage: bun scripts/check-map-load.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')

async function enterGarden(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Войти в сад/i }).click()
}

async function createPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  page.setDefaultTimeout(8_000)
  return { context, page }
}

const browser = await chromium.launch({ headless: true })

try {
  const delayed = await createPage(browser)
  let releaseNegative
  const negativeRelease = new Promise((resolve) => { releaseNegative = resolve })
  await delayed.page.route(/garden-map_negative\.webp/, async (route) => {
    await negativeRelease
    await route.continue()
  })
  await enterGarden(delayed.page)
  await delayed.page.waitForTimeout(150)

  const before = await delayed.page.evaluate(() => ({
    loading: Boolean(document.querySelector('.map-loading-screen')),
    ready: document.querySelector('.world-map-world')?.classList.contains('is-ready') ?? false,
    loaderOpaque: (() => {
      const loader = document.querySelector('.map-loading-screen')
      if (!loader) return false
      const style = getComputedStyle(loader)
      return style.visibility !== 'hidden' && style.opacity !== '0' && Number.parseFloat(style.zIndex || '0') >= 1
    })(),
  }))
  if (!before.loading || before.ready || !before.loaderOpaque) {
    throw new Error(`clean map was exposed before the negative layer: ${JSON.stringify(before)}`)
  }
  const loadingCopy = await delayed.page.locator('.map-loading-screen').textContent()
  if (!loadingCopy?.includes('Заходим в сад')) {
    throw new Error(`unexpected map loader copy: ${JSON.stringify(loadingCopy)}`)
  }

  releaseNegative()
  await delayed.page.waitForTimeout(1_000)
  if (!await delayed.page.locator('.world-map-world.is-ready').count()) {
    const state = await delayed.page.evaluate(() => ({
      loader: document.querySelector('.map-loading-screen')?.textContent,
      world: document.querySelector('.world-map-world')?.className,
    }))
    throw new Error(`map did not become ready after releasing the negative layer: ${JSON.stringify(state)}`)
  }
  const after = await delayed.page.evaluate(() => ({
    loading: Boolean(document.querySelector('.map-loading-screen')),
    canvasVisible: getComputedStyle(document.querySelector('.world-map-canvas')).visibility === 'visible',
  }))
  if (after.loading || !after.canvasVisible) {
    throw new Error(`map did not appear atomically: ${JSON.stringify(after)}`)
  }
  await delayed.context.close()

  const failed = await createPage(browser)
  let failNegative = true
  await failed.page.route(/garden-map_negative\.webp/, (route) => failNegative ? route.abort('failed') : route.continue())
  await enterGarden(failed.page)
  await failed.page.waitForSelector('.map-loading-screen.has-error')
  const errorState = await failed.page.evaluate(() => ({
    ready: document.querySelector('.world-map-world')?.classList.contains('is-ready') ?? false,
    canvasVisible: getComputedStyle(document.querySelector('.world-map-canvas')).visibility === 'visible',
    hasErrorClass: document.querySelector('.world-map-viewport')?.classList.contains('has-map-error') ?? false,
  }))
  if (errorState.ready || errorState.canvasVisible || !errorState.hasErrorClass) {
    throw new Error(`failed map exposed a partial layer: ${JSON.stringify(errorState)}`)
  }

  failNegative = false
  await failed.page.getByRole('button', { name: 'Повторить' }).click()
  await failed.page.waitForTimeout(1_000)
  if (!await failed.page.locator('.world-map-world.is-ready').count()) {
    const state = await failed.page.evaluate(() => ({
      loader: document.querySelector('.map-loading-screen')?.textContent,
      world: document.querySelector('.world-map-world')?.className,
      canvas: Boolean(document.querySelector('.world-map-canvas')),
    }))
    throw new Error(`retry did not make the map ready: ${JSON.stringify(state)}`)
  }
  if (await failed.page.locator('.map-loading-screen').count()) {
    throw new Error('retry did not dismiss the map loader')
  }
  await failed.context.close()
  console.log('OK: map remains hidden until both layers decode and retry recovers')
} finally {
  await browser.close()
}
