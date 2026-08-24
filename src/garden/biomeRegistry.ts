import type { BiomeCulture } from '../data/mapLayout'

export type PlantRarity = 'common' | 'rare' | 'veryRare'

export type PlantDefinition = Readonly<{
  id: string
  biomeId: string
  rarity: PlantRarity
  displayName: string
  asset: string
}>

export type BiomeGroundStyle = Readonly<{
  fill: string
  accent: string
  pattern: 'leaf' | 'furrow' | 'water' | 'petal' | 'stone' | 'grass'
}>

export type BiomeDefinition = Readonly<{
  id: string
  culture: BiomeCulture
  name: string
  groundStyle: BiomeGroundStyle
  plants: Readonly<Record<PlantRarity, PlantDefinition>>
}>

type BiomeSeed = Readonly<{
  id: string
  culture: BiomeCulture
  name: string
  groundStyle: BiomeGroundStyle
  plantNames: Readonly<Record<PlantRarity, string>>
}>

function plantId(culture: BiomeCulture, rarity: PlantRarity): string {
  return `${culture}-${rarity === 'veryRare' ? 'very-rare' : rarity}`
}

function plantAsset(culture: BiomeCulture, rarity: PlantRarity): string {
  const fileName = rarity === 'veryRare' ? 'very_rare.png' : `${rarity}.png`
  return `assets/garden/plants/${culture}/${fileName}`
}

function defineBiome(seed: BiomeSeed): BiomeDefinition {
  const plant = (rarity: PlantRarity): PlantDefinition => ({
    id: plantId(seed.culture, rarity),
    biomeId: seed.id,
    rarity,
    displayName: seed.plantNames[rarity],
    asset: plantAsset(seed.culture, rarity),
  })
  return {
    id: seed.id,
    culture: seed.culture,
    name: seed.name,
    groundStyle: seed.groundStyle,
    plants: {
      common: plant('common'),
      rare: plant('rare'),
      veryRare: plant('veryRare'),
    },
  }
}

/**
 * The established 15 Hanzi Garden cultures remain the content vocabulary.
 * Procedural generation chooses regions from this registry; no generator or
 * renderer contains culture-specific conditionals.
 */
export const BIOME_REGISTRY: readonly BiomeDefinition[] = [
  defineBiome({
    id: 'biome-01', culture: 'bamboo', name: 'Bamboo Grove',
    groundStyle: { fill: '#607a42', accent: '#92ad5f', pattern: 'leaf' },
    plantNames: { common: 'Green Bamboo', rare: 'Golden Bamboo', veryRare: 'Black Ornamental Bamboo' },
  }),
  defineBiome({
    id: 'biome-02', culture: 'rice', name: 'Rice Terrace',
    groundStyle: { fill: '#8b8744', accent: '#d0bf63', pattern: 'furrow' },
    plantNames: { common: 'Jade Rice', rare: 'Golden Rice', veryRare: 'Crimson Heritage Rice' },
  }),
  defineBiome({
    id: 'biome-03', culture: 'lotus', name: 'Lotus Wetland',
    groundStyle: { fill: '#4f7b73', accent: '#82aaa1', pattern: 'water' },
    plantNames: { common: 'Pink Lotus', rare: 'White Lotus', veryRare: 'Blue Moon Lotus' },
  }),
  defineBiome({
    id: 'biome-04', culture: 'tea', name: 'Tea Garden',
    groundStyle: { fill: '#61733d', accent: '#93a45b', pattern: 'leaf' },
    plantNames: { common: 'Tea Shrub', rare: 'Silver-tip Tea', veryRare: 'Ancient Twisted Tea Tree' },
  }),
  defineBiome({
    id: 'biome-05', culture: 'blossom', name: 'Sakura Grove',
    groundStyle: { fill: '#8b686b', accent: '#d6a2a8', pattern: 'petal' },
    plantNames: { common: 'Pink Sakura', rare: 'White Sakura', veryRare: 'Weeping Sakura' },
  }),
  defineBiome({
    id: 'biome-06', culture: 'peony', name: 'Peony Garden',
    groundStyle: { fill: '#805269', accent: '#c9849d', pattern: 'petal' },
    plantNames: { common: 'Pink Peony', rare: 'Golden Peony', veryRare: 'Tree Peony' },
  }),
  defineBiome({
    id: 'biome-07', culture: 'chrysanthemum', name: 'Chrysanthemum Garden',
    groundStyle: { fill: '#88743e', accent: '#c9ad5a', pattern: 'petal' },
    plantNames: { common: 'Yellow Chrysanthemum', rare: 'Spider Chrysanthemum', veryRare: 'Green Imperial Chrysanthemum' },
  }),
  defineBiome({
    id: 'biome-08', culture: 'pine', name: 'Pine and Rock Garden',
    groundStyle: { fill: '#405c49', accent: '#7d8a72', pattern: 'stone' },
    plantNames: { common: 'Garden Pine', rare: 'Wind-swept Pine', veryRare: 'Ancient Bonsai Pine' },
  }),
  defineBiome({
    id: 'biome-09', culture: 'persimmon', name: 'Persimmon Orchard',
    groundStyle: { fill: '#7d5835', accent: '#b47a43', pattern: 'leaf' },
    plantNames: { common: 'Young Persimmon', rare: 'Golden Persimmon', veryRare: 'Lantern Persimmon' },
  }),
  defineBiome({
    id: 'biome-10', culture: 'orchid', name: 'Orchid Garden',
    groundStyle: { fill: '#6f5b78', accent: '#a78fb4', pattern: 'petal' },
    plantNames: { common: 'Purple Orchid', rare: 'White Crane Orchid', veryRare: 'Ghost Orchid' },
  }),
  defineBiome({
    id: 'biome-11', culture: 'berries', name: 'Berry Woodland',
    groundStyle: { fill: '#67484e', accent: '#95636d', pattern: 'leaf' },
    plantNames: { common: 'Red Berry Shrub', rare: 'Snowberry Shrub', veryRare: 'Jewel Berry Topiary' },
  }),
  defineBiome({
    id: 'biome-12', culture: 'rapeseed', name: 'Rapeseed Field',
    groundStyle: { fill: '#8f8140', accent: '#d2bd54', pattern: 'furrow' },
    plantNames: { common: 'Yellow Rapeseed', rare: 'White Rapeseed', veryRare: 'Sunset Rapeseed' },
  }),
  defineBiome({
    id: 'biome-13', culture: 'wheat', name: 'Wheat Field',
    groundStyle: { fill: '#856f3e', accent: '#c7a85c', pattern: 'furrow' },
    plantNames: { common: 'Golden Wheat', rare: 'Silver Wheat', veryRare: 'Black-bearded Wheat' },
  }),
  defineBiome({
    id: 'biome-14', culture: 'wisteria', name: 'Wisteria Woodland',
    groundStyle: { fill: '#625676', accent: '#9d83b5', pattern: 'petal' },
    plantNames: { common: 'Lavender Wisteria', rare: 'White Wisteria', veryRare: 'Ancient Cascading Wisteria' },
  }),
  defineBiome({
    id: 'biome-15', culture: 'herbs', name: 'Medicinal Herb Garden',
    groundStyle: { fill: '#4f694b', accent: '#7f9b70', pattern: 'grass' },
    plantNames: { common: 'Mugwort', rare: 'Flowering Angelica', veryRare: 'Spirit Ginseng' },
  }),
]

export const BIOME_BY_ID = new Map(BIOME_REGISTRY.map((biome) => [biome.id, biome]))
export const PLANT_REGISTRY: readonly PlantDefinition[] = BIOME_REGISTRY.flatMap((biome) => [
  biome.plants.common,
  biome.plants.rare,
  biome.plants.veryRare,
])
export const PLANT_BY_ID = new Map(PLANT_REGISTRY.map((plant) => [plant.id, plant]))
