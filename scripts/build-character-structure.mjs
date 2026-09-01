#!/usr/bin/env bun

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const paths = {
  characters: resolve(root, 'src/data/rth.json'),
  meanings: resolve(root, '3500 одни иероглифы - 3500 иероглифов.csv'),
  components: resolve(root, 'greedy_components.csv'),
  componentNames: resolve(root, 'GF0014-2009_Мои_правки.csv'),
  fallbacks: resolve(root, 'data/keyword-fallbacks.json'),
  graphics: resolve(root, 'data/component-graphics.json'),
  structureOutput: resolve(root, 'src/data/character_structure_ru.json'),
  graphicsOutput: resolve(root, 'public/assets/components'),
}

const EXPECTED_MISSING_COMPOSITIONS = new Set([
  '吾', '哇', '尧', '尹', '廿', '荫', '酋', '襄', '韦', '彦', '馨', '寅', '曰',
  '炯', '亨', '嘎', '黯', '嘛', '愣', '惟', '啪', '怡', '稣', '黏', '佐', '弘',
  '禅', '嘻', '尴', '尬', '耶', '藉', '麟', '魅',
])

const EXPECTED_GF_DUPLICATES = new Set(['丷', '丁', '⺈', '𧘇'])

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (character !== '\r') {
      field += character
    }
  }

  if (quoted) throw new Error('Unclosed quoted CSV field')
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function assertSetEquals(actual, expected, label) {
  const missing = [...expected].filter((value) => !actual.has(value))
  const unexpected = [...actual].filter((value) => !expected.has(value))
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(`${label}: missing [${missing.join(' ')}], unexpected [${unexpected.join(' ')}]`)
  }
}

function buildStructureCatalog() {
  const characters = readJson(paths.characters)
  const fallbackByHanzi = readJson(paths.fallbacks)

  const meaningRows = parseCsv(readFileSync(paths.meanings, 'utf8'))
  const meaningHeader = meaningRows.shift()
  if (meaningHeader?.join('|') !== 'Иероглиф|Основное значение|Дополнительное значение|Примечание') {
    throw new Error(`Unexpected meaning CSV header: ${meaningHeader?.join('|')}`)
  }
  const meaningByHanzi = new Map(
    meaningRows.filter((row) => row[0]).map((row) => [
      row[0],
      { keyword: row[1]?.trim(), primitive: row[2]?.trim() || null },
    ]),
  )

  const compositionRows = parseCsv(readFileSync(paths.components, 'utf8'))
  const compositionHeader = compositionRows.shift()?.map((cell) => cell.replace(/^\uFEFF/, ''))
  if (compositionHeader?.slice(0, 3).join('|') !== 'является фонетико-семантическим компонентом|фонетик|汉字') {
    throw new Error(`Unexpected composition CSV header: ${compositionHeader?.join('|')}`)
  }
  const compositionByHanzi = new Map(
    compositionRows.filter((row) => row[2]).map((row) => [row[2], row.slice(3).filter(Boolean)]),
  )

  const gfRows = parseCsv(readFileSync(paths.componentNames, 'utf8')).slice(3).filter((row) => row[2])
  const componentNameByGlyph = new Map()
  const duplicateGfGlyphs = new Set()
  for (const row of gfRows) {
    const glyph = row[2]
    if (componentNameByGlyph.has(glyph)) {
      duplicateGfGlyphs.add(glyph)
      continue
    }
    componentNameByGlyph.set(glyph, row[4]?.trim())
  }
  assertSetEquals(duplicateGfGlyphs, EXPECTED_GF_DUPLICATES, 'GF duplicate glyphs changed')

  if (characters.length !== 2974 || new Set(characters.map((item) => item.hanzi)).size !== 2974) {
    throw new Error('Historical character source must contain 2,974 unique Hanzi')
  }

  const missingMeanings = new Set(
    characters.filter((item) => !meaningByHanzi.has(item.hanzi)).map((item) => item.hanzi),
  )
  assertSetEquals(missingMeanings, new Set(Object.keys(fallbackByHanzi)), 'Meaning fallbacks are stale')

  const missingCompositions = new Set(
    characters.filter((item) => !compositionByHanzi.has(item.hanzi)).map((item) => item.hanzi),
  )
  assertSetEquals(missingCompositions, EXPECTED_MISSING_COMPOSITIONS, 'Missing greedy compositions changed')

  return characters.map(({ hanzi }) => {
    const meaning = meaningByHanzi.get(hanzi) ?? fallbackByHanzi[hanzi]
    if (!meaning?.keyword) throw new Error(`Missing keyword for ${hanzi}`)

    const rawComponents = compositionByHanzi.get(hanzi) ?? []
    const componentGlyphs = rawComponents.length === 1 && rawComponents[0] === hanzi
      ? []
      : rawComponents
    const components = componentGlyphs.map((componentHanzi) => {
      const keyword = meaningByHanzi.get(componentHanzi)?.keyword
        ?? componentNameByGlyph.get(componentHanzi)
      if (!keyword) throw new Error(`Missing Russian name for component ${componentHanzi} in ${hanzi}`)
      return { hanzi: componentHanzi, keyword }
    })

    return {
      hanzi,
      keyword: meaning.keyword,
      primitive: meaning.primitive,
      components,
    }
  })
}

function pathBounds(pathData) {
  const numbers = pathData.match(/-?(?:\d+\.\d+|\d+|\.\d+)/g)?.map(Number) ?? []
  if (numbers.length < 2 || numbers.length % 2 !== 0) {
    throw new Error(`Cannot calculate path bounds for: ${pathData}`)
  }
  const xs = []
  const ys = []
  for (let index = 0; index < numbers.length; index += 2) {
    xs.push(numbers[index])
    ys.push(numbers[index + 1])
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function buildComponentGraphics() {
  const entries = readJson(paths.graphics)
  const glyphs = new Set()
  const fileNames = new Set()
  const outputs = []

  for (const entry of entries) {
    if (glyphs.has(entry.glyph)) throw new Error(`Duplicate graphic glyph ${entry.glyph}`)
    if (fileNames.has(entry.fileName)) throw new Error(`Duplicate graphic filename ${entry.fileName}`)
    glyphs.add(entry.glyph)
    fileNames.add(entry.fileName)

    const characterData = readJson(resolve(root, `public/hanzi/${entry.sourceHanzi}.json`))
    const strokes = entry.strokeIndexes.map((index) => {
      const stroke = characterData.strokes[index]
      if (!stroke) throw new Error(`Missing stroke ${index} in ${entry.sourceHanzi} for ${entry.glyph}`)
      return stroke
    })
    const bounds = strokes.map(pathBounds).reduce((combined, bounds) => ({
      minX: Math.min(combined.minX, bounds.minX),
      maxX: Math.max(combined.maxX, bounds.maxX),
      minY: Math.min(combined.minY, bounds.minY),
      maxY: Math.max(combined.maxY, bounds.maxY),
    }))
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    const padding = Math.max(width, height) * 0.12
    const viewBox = [
      bounds.minX - padding,
      900 - bounds.maxY - padding,
      width + padding * 2,
      height + padding * 2,
    ].map((number) => Number(number.toFixed(2))).join(' ')
    const title = entry.label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    const pathsSvg = strokes.map((stroke) => `    <path d="${stroke}"/>`).join('\n')
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" role="img">',
      `  <title>${title}</title>`,
      '  <g transform="scale(1,-1) translate(0,-900)" fill="#4d653e">',
      pathsSvg,
      '  </g>',
      '</svg>',
      '',
    ].join('\n')
    outputs.push({
      path: resolve(paths.graphicsOutput, `${entry.fileName}.svg`),
      content: svg,
    })
  }
  return outputs
}

const catalog = buildStructureCatalog()
const outputs = [
  { path: paths.structureOutput, content: `${JSON.stringify(catalog)}\n` },
  ...buildComponentGraphics(),
]

if (process.argv.includes('--check')) {
  const stale = outputs.filter((output) => readFileSync(output.path, 'utf8') !== output.content)
  if (stale.length > 0) {
    throw new Error(`Generated content is stale: ${stale.map((output) => output.path).join(', ')}`)
  }
  console.log(`Verified ${catalog.length} character structures and component SVG assets`)
} else {
  mkdirSync(paths.graphicsOutput, { recursive: true })
  for (const output of outputs) writeFileSync(output.path, output.content)
  console.log(`Wrote ${catalog.length} character structures and component SVG assets`)
}
