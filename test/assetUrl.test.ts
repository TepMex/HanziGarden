import { describe, expect, test } from 'bun:test'
import { resolveAssetUrl } from '../src/assetUrl'

describe('resolveAssetUrl', () => {
  test('relative Vite base resolves against the document, not the CSS bundle folder', () => {
    expect(
      resolveAssetUrl('./', 'assets/cleaning-court-clear.webp', 'file:///android_asset/www/index.html'),
    ).toBe('file:///android_asset/www/assets/cleaning-court-clear.webp')
  })

  test('does not double the assets segment the way CSS var() url resolution would', () => {
    const href = resolveAssetUrl(
      './',
      'assets/cleaning-court-clear.webp',
      'http://127.0.0.1:8765/index.html',
    )
    expect(href).toBe('http://127.0.0.1:8765/assets/cleaning-court-clear.webp')
    expect(href.includes('assets/assets/')).toBe(false)
  })

  test('absolute Pages base stays rooted at the site path', () => {
    expect(
      resolveAssetUrl(
        '/HanziGarden/',
        'assets/garden-map.webp',
        'https://example.com/HanziGarden/index.html',
      ),
    ).toBe('https://example.com/HanziGarden/assets/garden-map.webp')
  })
})
