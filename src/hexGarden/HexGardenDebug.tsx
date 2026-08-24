import { createGardenProgress, type SaveGame } from '../db'
import { createGardenSeed } from './rng'
import { revealEntireGarden } from './gardenState'
import type { HexGardenDebugState } from './HexGardenOverlay'

export function HexGardenDebugPanel({
  save,
  debug,
  onDebug,
  onSave,
}: {
  save: SaveGame
  debug: HexGardenDebugState
  onDebug: (debug: HexGardenDebugState) => void
  onSave: (save: SaveGame) => void
}) {
  return (
    <form
      className="hex-garden-debug-panel"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const seed = String(data.get('gardenSeed') ?? '').trim()
        if (!seed) return
        onSave({ ...save, gardenSeed: seed, updatedAt: Date.now() })
      }}
    >
      <span>Hex garden debug</span>
      <input name="gardenSeed" defaultValue={save.gardenSeed} key={save.gardenSeed} aria-label="Garden seed" />
      <div className="hex-debug-actions">
        <button type="submit">Set seed</button>
        <button
          type="button"
          onClick={() => onSave({
            ...save,
            ...createGardenProgress(createGardenSeed()),
            updatedAt: Date.now(),
          })}
        >
          New seed
        </button>
        <button
          type="button"
          onClick={() => onDebug({ ...debug, revealAll: !debug.revealAll })}
        >
          {debug.revealAll ? 'Hide map' : 'Reveal all'}
        </button>
        <button
          type="button"
          onClick={() => onSave({ ...save, clearedHexes: revealEntireGarden(), pendingClearActions: 0, updatedAt: Date.now() })}
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={() => onSave({ ...save, pendingClearActions: save.pendingClearActions + 1, updatedAt: Date.now() })}
        >
          +1 clear
        </button>
        <button type="button" onClick={() => onDebug({ ...debug, showCoordinates: !debug.showCoordinates })}>
          {debug.showCoordinates ? 'Hide q,r' : 'Show q,r'}
        </button>
        <button type="button" onClick={() => onDebug({ ...debug, showBiomeIds: !debug.showBiomeIds })}>
          {debug.showBiomeIds ? 'Hide biomes' : 'Show biomes'}
        </button>
      </div>
    </form>
  )
}
