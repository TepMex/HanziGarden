import { HEX_BIOMES } from './biomeRegistry'

export const PLANT_ASSET_MANIFEST = HEX_BIOMES.flatMap((biome) => [
  biome.plants.common,
  biome.plants.rare,
  biome.plants.veryRare,
].map((plant) => ({
  id: plant.id,
  biomeId: plant.biomeId,
  rarity: plant.rarity,
  displayName: plant.displayName,
  asset: plant.asset,
})))
