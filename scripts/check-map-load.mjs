#!/usr/bin/env bun
/**
 * Regression: the clean world must never be exposed while the negative SVG
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
    cleanVisible: (() => {
      const clean = document.querySelector('.world-map-clean')
      return Boolean(clean && getComputedStyle(clean).visibility !== 'hidden' && getComputedStyle(clean.parentElement).visibility !== 'hidden')
    })(),
  }))
  if (!before.loading || before.ready || before.cleanVisible) {
    throw new Error(`clean map was exposed before the negative layer: ${JSON.stringify(before)}`)
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
    cleanVisible: getComputedStyle(document.querySelector('.world-map-clean').parentElement).visibility === 'visible',
    weedPresent: Boolean(document.querySelector('.world-map-weed image')),
  }))
  if (after.loading || !after.cleanVisible || !after.weedPresent) {
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
    cleanVisible: getComputedStyle(document.querySelector('.world-map-clean').parentElement).visibility === 'visible',
  }))
  if (errorState.ready || errorState.cleanVisible) {
    throw new Error(`failed map exposed a partial layer: ${JSON.stringify(errorState)}`)
  }

  failNegative = false
  await failed.page.getByRole('button', { name: 'Повторить' }).click()
  await failed.page.waitForTimeout(1_000)
  if (!await failed.page.locator('.world-map-world.is-ready').count()) {
    const state = await failed.page.evaluate(() => ({
      loader: document.querySelector('.map-loading-screen')?.textContent,
      world: document.querySelector('.world-map-world')?.className,
      negative: document.querySelector('.world-map-weed image')?.getAttribute('href'),
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
