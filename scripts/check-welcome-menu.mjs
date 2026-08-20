#!/usr/bin/env bun
import { chromium } from 'playwright'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '')

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 380, height: 648 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('navigation', { name: 'Главное меню' }).waitFor()

  const viewportOverflow = await page.evaluate(() => ({
    innerWidth,
    innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }))
  if (
    viewportOverflow.scrollWidth > viewportOverflow.innerWidth ||
    viewportOverflow.scrollHeight > viewportOverflow.innerHeight
  ) {
    throw new Error(`welcome screen overflows the viewport: ${JSON.stringify(viewportOverflow)}`)
  }

  const bottomEdgeBelongsToWelcome = await page.evaluate(() =>
    document.elementFromPoint(innerWidth / 2, innerHeight - 1)?.closest('.welcome-screen') !== null,
  )
  if (!bottomEdgeBelongsToWelcome) {
    throw new Error('content behind the welcome screen is visible at the bottom edge')
  }

  const welcomeOverflow = await page.locator('.welcome-screen').evaluate((element) => ({
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
  }))
  if (
    welcomeOverflow.scrollWidth > welcomeOverflow.clientWidth ||
    welcomeOverflow.scrollHeight > welcomeOverflow.clientHeight
  ) {
    throw new Error(`welcome screen itself is scrollable: ${JSON.stringify(welcomeOverflow)}`)
  }

  const welcomeBackground = await page.locator('.welcome-screen').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      repeat: style.backgroundRepeat,
      size: style.backgroundSize,
    }
  })
  if (welcomeBackground.repeat !== 'no-repeat' || welcomeBackground.size !== 'cover') {
    throw new Error(`welcome background can tile during mobile overscroll: ${JSON.stringify(welcomeBackground)}`)
  }

  const aboutButton = page.getByRole('button', { name: 'Об игре', exact: true })
  await aboutButton.click()
  await page.getByRole('heading', { name: 'Об игре', exact: true }).waitFor()
  if (await page.getByText('О программе', { exact: true }).count()) {
    throw new Error('old "О программе" label is still visible')
  }

  await context.close()
  console.log('OK: welcome screen does not overflow or expose underlying content, and About is labelled "Об игре"')
} finally {
  await browser.close()
}
