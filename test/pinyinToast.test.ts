import { expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { completionPinyinToShow } from '../src/PinyinToast'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

test('shows pinyin for the same completion-beat duration as the XP toast', () => {
  expect(styles).toContain('animation: pinyin-toast 1.05s ease both;')
  expect(styles).toContain(
    '@keyframes pinyin-toast-reduced { from, 99% { opacity: 1; transform: translate(-50%, 0) scale(1); } to { opacity: 0; transform: translate(-50%, 0) scale(1); } }',
  )
  expect(styles).toContain(
    '.pinyin-toast { animation: pinyin-toast-reduced 1.05s step-end both !important; }',
  )
})

test('hides leftover pinyin when the battle advances to another Hanzi', () => {
  expect(completionPinyinToShow({ characterId: 'rsh-0001', pinyin: 'yī' }, 'rsh-0001')).toBe('yī')
  expect(completionPinyinToShow({ characterId: 'rsh-0001', pinyin: 'yī' }, 'rsh-0002')).toBeNull()
  expect(completionPinyinToShow(null, 'rsh-0001')).toBeNull()
})
