import { useEffect, useRef } from 'react'
import { assetUrl } from '../assetUrl'
import { GARDEN_HEIGHT, GARDEN_WIDTH } from '../data/mapLayout'
import type { SaveGame } from '../db'
import { hexGardenArt } from './hexGardenArt'
import { drawHexGarden } from './hexGardenRenderer'

type Props = { save: SaveGame; loadAttempt: number; onReady: () => void; onError: () => void }
type Sprites = Map<string, HTMLImageElement>

let spritesPromise: Promise<Sprites> | null = null
function loadSprites(): Promise<Sprites> {
  spritesPromise ??= Promise.all([...new Set(Object.values(hexGardenArt).flatMap((art) => art.sprites))].map((id) => new Promise<[string, HTMLImageElement]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve([id, image])
    image.onerror = () => reject(new Error(`Could not load hex garden plant ${id}`))
    image.src = assetUrl(`assets/hex-garden/${id}.webp`)
  }))).then((entries) => new Map(entries)).catch((error: unknown) => { spritesPromise = null; throw error })
  return spritesPromise
}

export function HexGardenCanvas({ save, loadAttempt, onReady, onError }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    void loadSprites().then((sprites) => {
      if (cancelled || !ref.current) return
      drawHexGarden(ref.current.getContext('2d')!, save, sprites)
      window.requestAnimationFrame(() => { if (!cancelled) onReady() })
    }).catch(() => { if (!cancelled) onError() })
    return () => { cancelled = true }
  }, [save, loadAttempt, onReady, onError])
  return <canvas className="garden-map-canvas" ref={ref} width={GARDEN_WIDTH} height={GARDEN_HEIGHT} aria-hidden="true" />
}
