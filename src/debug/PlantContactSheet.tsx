import { BIOME_REGISTRY, PLANT_REGISTRY } from '../garden/biomeRegistry'
import { assetUrl } from '../assetUrl'

export function PlantContactSheet() {
  return (
    <main className="plant-contact-sheet">
      <header>
        <p>Development-only asset audit</p>
        <h1>Garden plant contact sheet</h1>
        <span>{BIOME_REGISTRY.length} biomes · {PLANT_REGISTRY.length} isolated sprites · 4 columns</span>
      </header>
      <section>
        {PLANT_REGISTRY.map((plant) => {
          const biome = BIOME_REGISTRY.find((candidate) => candidate.id === plant.biomeId)!
          return (
            <figure key={plant.id} data-rarity={plant.rarity}>
              <div className="plant-contact-canvas">
                <div className="plant-safe-area" />
                <img src={assetUrl(plant.asset)} alt="" />
              </div>
              <figcaption>
                <strong>{plant.displayName}</strong>
                <span>{biome.name}</span>
                <code>{plant.rarity}</code>
              </figcaption>
            </figure>
          )
        })}
      </section>
    </main>
  )
}
