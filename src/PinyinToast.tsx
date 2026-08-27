export function completionPinyinToShow(
  completed: { characterId: string; pinyin: string } | null,
  activeCharacterId: string | undefined,
): string | null {
  if (!completed || !activeCharacterId || completed.characterId !== activeCharacterId) return null
  return completed.pinyin
}

export function PinyinToast({ pinyin }: { pinyin: string }) {
  return (
    <p className="pinyin-toast" lang="zh-Latn" role="status" aria-live="polite">
      {pinyin}
    </p>
  )
}
