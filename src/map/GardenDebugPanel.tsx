import { useEffect, useState } from 'react'
import { Bug, ChevronDown, Eye, RefreshCw } from 'lucide-react'
import type { SaveGame } from '../db'
import { GARDEN_HEXES, hexId } from '../garden/hexGrid'
import { CENTER_HEX_ID, createGardenSeed } from '../garden/gardenState'

type GardenDebugPanelProps = {
  save: SaveGame
  showCoordinates: boolean
  showBiomeIds: boolean
  onShowCoordinates: (visible: boolean) => void
  onShowBiomeIds: (visible: boolean) => void
  onSave: (save: SaveGame) => void
}

export function GardenDebugPanel({
  save,
  showCoordinates,
  showBiomeIds,
  onShowCoordinates,
  onShowBiomeIds,
  onSave,
}: GardenDebugPanelProps) {
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState(save.gardenSeed)
  useEffect(() => setSeed(save.gardenSeed), [save.gardenSeed])

  const replaceSeed = (nextSeed: string) => {
    if (!nextSeed.trim()) return
    onSave({
      ...save,
      gardenSeed: nextSeed.trim(),
      clearedHexes: [CENTER_HEX_ID],
      pendingClearActions: 0,
      lastActiveHexId: CENTER_HEX_ID,
      updatedAt: Date.now(),
    })
  }

  return (
    <aside className={`garden-debug-panel ${open ? 'is-open' : ''}`}>
      <button className="garden-debug-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        <Bug size={15} /> Garden debug <ChevronDown size={14} />
      </button>
      {open && (
        <div className="garden-debug-content">
          <label>
            Seed
            <span>
              <input value={seed} onChange={(event) => setSeed(event.target.value)} />
              <button type="button" onClick={() => replaceSeed(seed)}>Set</button>
            </span>
          </label>
          <button type="button" onClick={() => {
            const nextSeed = createGardenSeed()
            setSeed(nextSeed)
            replaceSeed(nextSeed)
          }}>
            <RefreshCw size={14} /> New Random Seed
          </button>
          <button type="button" onClick={() => onSave({
            ...save,
            clearedHexes: GARDEN_HEXES.map(hexId),
            pendingClearActions: 0,
            updatedAt: Date.now(),
          })}>
            <Eye size={14} /> Reveal Entire Garden
          </button>
          <label className="garden-debug-check">
            <input type="checkbox" checked={showCoordinates} onChange={(event) => onShowCoordinates(event.target.checked)} />
            Show coordinates
          </label>
          <label className="garden-debug-check">
            <input type="checkbox" checked={showBiomeIds} onChange={(event) => onShowBiomeIds(event.target.checked)} />
            Show biome IDs
          </label>
          <small>generation v{save.gardenGenerationVersion} · {save.clearedHexes.length}/217 cleared</small>
        </div>
      )}
    </aside>
  )
}
