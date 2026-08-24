import { assetUrl } from '../assetUrl'
import { HEX_BIOMES } from './biomeRegistry'

/** Dev-only 4×N contact sheet for generated plant sprites. Not a production asset. */
export function HexPlantContactSheet() {
  const plants = HEX_BIOMES.flatMap((biome) => [
    biome.plants.common,
    biome.plants.rare,
    biome.plants.veryRare,
  ])
  return (
    <main className="hex-plant-contact-sheet">
      <h1>Hex plant contact sheet</h1>
      <p>Development only. 4 columns × {Math.ceil(plants.length / 4)} rows.</p>
      <div className="hex-plant-grid">
        {plants.map((plant) => (
          <figure key={plant.id}>
            <img src={assetUrl(plant.asset)} alt={plant.displayName} />
            <figcaption>
              <strong>{plant.displayName}</strong>
              <span>{plant.rarity}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <style>{`
        .hex-plant-contact-sheet { min-height: 100dvh; margin: 0; padding: 24px; background: #1a2420; color: #efe5c9; font: 14px/1.4 ui-sans-serif, system-ui; }
        .hex-plant-contact-sheet h1 { margin: 0 0 8px; font-size: 22px; }
        .hex-plant-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .hex-plant-grid figure { margin: 0; padding: 12px; border-radius: 16px; background: repeating-conic-gradient(#2a3330 0 25%, #1f2724 0 50%) 0 0 / 24px 24px; }
        .hex-plant-grid img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; }
        .hex-plant-grid figcaption { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; color: #efe5c9; }
      `}</style>
    </main>
  )
}
