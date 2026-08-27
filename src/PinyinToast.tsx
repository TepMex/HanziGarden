export function PinyinToast({ pinyin }: { pinyin: string }) {
  return (
    <p className="pinyin-toast" lang="zh-Latn" role="status" aria-live="polite">
      {pinyin}
    </p>
  )
}
