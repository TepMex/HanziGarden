import { expect, test } from 'bun:test'
import { readFileSync } from 'fs'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

test('keeps the XP toast statically visible for about one second with reduced motion', () => {
  expect(styles).toContain(
    '@keyframes xp-toast-reduced { from, 99% { opacity: 1; transform: translate(-50%, 0) scale(1); } to { opacity: 0; transform: translate(-50%, 0) scale(1); } }',
  )
  expect(styles).toContain(
    '.xp-toast { animation: xp-toast-reduced 1.05s step-end both !important; }',
  )
})
