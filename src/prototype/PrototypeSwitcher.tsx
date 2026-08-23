import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type PrototypeVariant = 'A' | 'B' | 'C'
export type PrototypeVariantOption = { key: PrototypeVariant; name: string }

const defaultVariants: PrototypeVariantOption[] = [
  { key: 'A', name: 'Карта' },
  { key: 'B', name: 'Сетка' },
  { key: 'C', name: 'Маска' },
]

function cycleVariant(
  variants: PrototypeVariantOption[],
  current: PrototypeVariant,
  direction: -1 | 1,
): PrototypeVariant {
  const index = variants.findIndex((variant) => variant.key === current)
  return variants[(index + direction + variants.length) % variants.length]!.key
}

export function PrototypeSwitcher({
  current,
  onChange,
  variants = defaultVariants,
}: {
  current: PrototypeVariant
  onChange: (variant: PrototypeVariant) => void
  variants?: PrototypeVariantOption[]
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, [contenteditable="true"]'))) return
      if (event.key === 'ArrowLeft') onChange(cycleVariant(variants, current, -1))
      if (event.key === 'ArrowRight') onChange(cycleVariant(variants, current, 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, onChange, variants])

  const currentVariant = variants.find((variant) => variant.key === current) ?? variants[0]!

  return (
    <nav className="prototype-switcher" aria-label="Варианты отладочной страницы">
      <button type="button" onClick={() => onChange(cycleVariant(variants, current, -1))} aria-label="Предыдущий вариант">
        <ChevronLeft size={18} />
      </button>
      <span><b>{currentVariant.key}</b> — {currentVariant.name}</span>
      <button type="button" onClick={() => onChange(cycleVariant(variants, current, 1))} aria-label="Следующий вариант">
        <ChevronRight size={18} />
      </button>
    </nav>
  )
}
