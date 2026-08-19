#!/usr/bin/env bun
/**
 * Regression: longest real keywords stay legible in at most three lines and
 * never overlap the handwriting target on supported viewport extremes.
 *
 * Usage: bun scripts/check-keyword-layout.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { beds } from '../src/data/model.ts'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')
const cases = [
  { keyword: 'несовершеннолетний', bedId: 'bed-036' },
  { keyword: 'принять меры предосторожности против', bedId: 'bed-153' },
  { keyword: 'специальность', bedId: 'bed-078', primitive: 'трубка из кукурузного початка' },
]
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
]

function saveForCase({ keyword, bedId }) {
  const bed = beds.find((candidate) => candidate.id === bedId)
  if (!bed) throw new Error(`missing ${bedId}`)
  const index = bed.characters.findIndex((character) => character.keyword.ru === keyword)
  if (index < 0) throw new Error(`missing keyword ${keyword}`)
  return {
    id: 'main',
    version: 4,
    unlockedBedIds: [bedId],
    masteredBedIds: [],
    lastActiveBedId: bedId,
    seenCharacterIds: [],
    cards: Object.fromEntries(bed.characters.slice(0, index).map((character) => [character.id, { due: '2999-01-01T00:00:00.000Z' }])),
    reviewEvents: [],
    updatedAt: Date.now(),
  }
}

async function seedSave(page, save) {
  await page.evaluate(async (nextSave) => {
    sessionStorage.setItem('memory-garden-welcomed', 'yes')
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('memory-garden')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('saves', 'readwrite')
      transaction.objectStore('saves').put(nextSave)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, save)
}

const browser = await chromium.launch({ headless: true })

try {
  for (const viewport of viewports) {
    for (const testCase of cases) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /Войти в сад/i }).waitFor()
      await seedSave(page, saveForCase(testCase))
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.garden-map-content.is-ready')
      const bed = page.locator(`[data-bed-id="${testCase.bedId}"]`)
      await bed.click({ force: true })
      await page.waitForTimeout(450)
      if (!await page.locator('.battle-screen').count()) await bed.click({ force: true })
      await page.waitForSelector('.battle-screen')

      const metrics = await page.evaluate(() => {
        const keyword = document.querySelector('.prompt-scroll strong')
        const scroll = document.querySelector('.prompt-scroll')
        const writer = document.querySelector('.writing-circle')
        if (!keyword || !scroll || !writer) throw new Error('missing battle layout')
        const style = getComputedStyle(keyword)
        const keywordRect = keyword.getBoundingClientRect()
        const scrollRect = scroll.getBoundingClientRect()
        const writerRect = writer.getBoundingClientRect()
        const intersects = !(
          scrollRect.right <= writerRect.left || scrollRect.left >= writerRect.right ||
          scrollRect.bottom <= writerRect.top || scrollRect.top >= writerRect.bottom
        )
        return {
          text: keyword.textContent,
          primitive: document.querySelector('.primitive-prompt b')?.textContent,
          lines: Math.ceil(keywordRect.height / Number.parseFloat(style.lineHeight) - 0.01),
          fontSize: Number.parseFloat(style.fontSize),
          fits: keyword.scrollWidth <= keyword.clientWidth + 1,
          intersects,
        }
      })
      const expected = testCase.keyword.toLocaleUpperCase('ru')
      const expectedPrimitive = testCase.primitive
      if (metrics.text !== expected || metrics.primitive !== expectedPrimitive || metrics.lines > 3 || metrics.fontSize < 16 || !metrics.fits || metrics.intersects) {
        throw new Error(`keyword layout failed for ${JSON.stringify({ viewport, expected, metrics })}`)
      }
      await context.close()
    }
  }
  console.log('OK: longest keywords fit at every supported viewport')
} finally {
  await browser.close()
}
