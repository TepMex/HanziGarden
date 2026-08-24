/** Stroke geometry from Make Me a Hanzi / hanzi-writer-data JSON. */
export type HanziCharacterJson = {
  strokes: string[]
  medians: number[][][]
  radStrokes?: number[]
}

const charDataCache = new Map<string, Promise<HanziCharacterJson>>()

/**
 * Load Make Me a Hanzi stroke JSON for a character.
 *
 * Uses XHR instead of fetch: Chromium/Android WebView block Fetch against
 * `file://` (APK `file:///android_asset/www/...`), while XHR succeeds when
 * `allowFileAccessFromFileURLs` is enabled. Status `0` is a successful file:// read.
 *
 * Successful loads are reused for the rest of the session so quiz mistake
 * classification never issues a second network request for the same Hanzi.
 */
export function loadHanziCharData(char: string): Promise<HanziCharacterJson> {
  const cached = charDataCache.get(char)
  if (cached) return cached

  const request = loadHanziCharDataUncached(char)
  charDataCache.set(char, request)
  request.catch(() => {
    if (charDataCache.get(char) === request) charDataCache.delete(char)
  })
  return request
}

function loadHanziCharDataUncached(char: string): Promise<HanziCharacterJson> {
  const url = new URL(`./hanzi/${encodeURIComponent(char)}.json`, document.baseURI).href

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    if (xhr.overrideMimeType) {
      xhr.overrideMimeType('application/json')
    }
    xhr.onload = () => {
      // file:// often reports 0; http(s) reports 200.
      if (xhr.status !== 200 && xhr.status !== 0) {
        reject(new Error(`Нет данных для ${char} (HTTP ${xhr.status})`))
        return
      }
      try {
        resolve(JSON.parse(xhr.responseText) as HanziCharacterJson)
      } catch (error) {
        reject(error)
      }
    }
    xhr.onerror = () => reject(new Error(`Нет данных для ${char}`))
    xhr.send(null)
  })
}
