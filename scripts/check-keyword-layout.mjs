#!/usr/bin/env bun
/**
 * Regression: real keywords wrap only at word boundaries, stay legible in at
 * most three lines, and never overlap the writer on supported viewport extremes
 * or at maximum Android-style font scaling.
 *
 * Usage: bun scripts/check-keyword-layout.mjs [baseUrl] [keyword] [viewportWidth]
 */
import { chromium } from 'playwright'
import { beds } from '../src/data/model.ts'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')
const cases = [
  { keyword: 'выдающийся', bedId: 'bed-006', fontScale: 2 },
  { keyword: 'несовершеннолетний', bedId: 'bed-036' },
  { keyword: 'принять меры предосторожности против', bedId: 'bed-153' },
  { keyword: 'специальность', bedId: 'bed-078', primitive: 'трубка из кукурузного початка' },
]
const viewports = [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
]
const keywordFilter = process.argv[3]
const viewportWidthFilter = Number.parseInt(process.argv[4] ?? '', 10)
const selectedCases = keywordFilter ? cases.filter(({ keyword }) => keyword === keywordFilter) : cases
const selectedViewports = Number.isNaN(viewportWidthFilter)
  ? viewports
  : viewports.filter(({ width }) => width === viewportWidthFilter)

if (selectedCases.length === 0) throw new Error(`unknown keyword filter: ${keywordFilter}`)
if (selectedViewports.length === 0) throw new Error(`unknown viewport width filter: ${viewportWidthFilter}`)

function saveForCase({ keyword, bedId }) {
  const bed = beds.find((candidate) => candidate.id === bedId)
  if (!bed) throw new Error(`missing ${bedId}`)
  const index = bed.characters.findIndex((character) => character.keyword.ru === keyword)
  if (index < 0) throw new Error(`missing keyword ${keyword}`)
  return { bedId, precedingCharacterIds: bed.characters.slice(0, index).map((character) => character.id) }
}

async function seedSave(page, { bedId, precedingCharacterIds }) {
  await page.waitForFunction(() => Boolean(window.hanziGardenCheats))
  await page.evaluate(async ({ nextBedId, previousIds }) => {
    const save = await window.hanziGardenCheats.dumpDb('object')
    const card = {
      due: '2999-01-01T00:00:00.000Z',
      stability: 12,
      difficulty: 4,
      elapsed_days: 3,
      scheduled_days: 30,
      learning_steps: 0,
      reps: 2,
      lapses: 0,
      state: 2,
      last_review: '2026-08-19T10:00:00.000Z',
    }
    save.unlockedBedIds = [nextBedId]
    save.masteredBedIds = []
    save.lastActiveBedId = nextBedId
    save.seenCharacterIds = previousIds
    save.cards = Object.fromEntries(previousIds.map((id) => [id, card]))
    save.reviewEvents = []
    await window.hanziGardenCheats.loadDb(save)
  }, { nextBedId: bedId, previousIds: precedingCharacterIds })
}

const browser = await chromium.launch({ headless: true })

try {
  for (const viewport of selectedViewports) {
    for (const testCase of selectedCases) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
      const welcome = page.getByRole('button', { name: /Войти в сад/i })
      if (await welcome.count()) await welcome.click()
      await seedSave(page, saveForCase(testCase))
      if (testCase.fontScale) {
        await page.addStyleTag({ content: `:root { font-size: ${testCase.fontScale * 100}% !important; }` })
      }
      await page.waitForSelector('.garden-map-content.is-ready')
      const bed = page.locator(`[data-bed-id="${testCase.bedId}"]`)
      await bed.evaluate((element) => element.click())
      await page.waitForTimeout(450)
      if (!await page.locator('.battle-screen').count()) await bed.evaluate((element) => element.click())
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
        const textNode = keyword.firstChild
        if (!(textNode instanceof Text)) throw new Error('missing keyword text node')
        const characters = [...textNode.data]
        const lineTops = characters.map((_, index) => {
          const range = document.createRange()
          range.setStart(textNode, index)
          range.setEnd(textNode, index + 1)
          return range.getBoundingClientRect().top
        })
        const internalBreak = lineTops.some((top, index) => (
          index > 0 && Math.abs(top - lineTops[index - 1]) > 1 &&
          !/\s/u.test(characters[index - 1]) && !/\s/u.test(characters[index])
        ))
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
          clientWidth: keyword.clientWidth,
          scrollWidth: keyword.scrollWidth,
          internalBreak,
          intersects,
        }
      })
      const expected = testCase.keyword.toLocaleUpperCase('ru')
      const expectedPrimitive = testCase.primitive
      if (metrics.text !== expected || metrics.primitive !== expectedPrimitive || metrics.lines > 3 || metrics.fontSize < 10 || !metrics.fits || metrics.internalBreak || metrics.intersects) {
        throw new Error(`keyword layout failed for ${JSON.stringify({ viewport, expected, metrics })}`)
      }
      await context.close()
    }
  }
  console.log('OK: keywords fit without mid-word wrapping at every supported viewport')
} finally {
  await browser.close()
}
