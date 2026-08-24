import type { BiomeCulture } from '../data/mapLayout'

export type PlantRarity = 'common' | 'rare' | 'veryRare'

export type PlantDefinition = {
  id: string
  biomeId: string
  rarity: PlantRarity
  displayName: string
  asset: string
}

export type BiomeGroundStyle = {
  fill: string
  fillAlt: string
  stroke: string
}

export type BiomeDefinition = {
  id: string
  culture: BiomeCulture
  name: string
  groundStyle: BiomeGroundStyle
  plants: {
    common: PlantDefinition
    rare: PlantDefinition
    veryRare: PlantDefinition
  }
}

function plant(biomeId: string, culture: BiomeCulture, rarity: PlantRarity, displayName: string): PlantDefinition {
  const file = rarity === 'veryRare' ? 'very_rare' : rarity
  return {
    id: `${biomeId}-${rarity}`,
    biomeId,
    rarity,
    displayName,
    asset: `assets/garden/plants/${culture}/${file}.png`,
  }
}

function biome(
  index: number,
  culture: BiomeCulture,
  name: string,
  groundStyle: BiomeGroundStyle,
  plants: { common: string; rare: string; veryRare: string },
): BiomeDefinition {
  const id = `biome-${String(index).padStart(2, '0')}`
  return {
    id,
    culture,
    name,
    groundStyle,
    plants: {
      common: plant(id, culture, 'common', plants.common),
      rare: plant(id, culture, 'rare', plants.rare),
      veryRare: plant(id, culture, 'veryRare', plants.veryRare),
    },
  }
}

/**
 * The 15 official garden cultures, reused as hex biomes so the existing
 * naming, achievements, and battle art stay aligned.
 */
export const HEX_BIOMES: readonly BiomeDefinition[] = [
  biome(1, 'bamboo', 'Бамбуковая роща', { fill: '#4d6a38', fillAlt: '#5c7a44', stroke: '#314626' }, {
    common: 'Зелёный бамбук', rare: 'Золотой бамбук', veryRare: 'Чёрный бамбук',
  }),
  biome(2, 'rice', 'Рисовые террасы', { fill: '#8a8440', fillAlt: '#9a9350', stroke: '#5a5428' }, {
    common: 'Рисовые стебли', rare: 'Золотой рис', veryRare: 'Церемониальный рис',
  }),
  biome(3, 'lotus', 'Лотосовый пруд', { fill: '#3f6d68', fillAlt: '#4d7e78', stroke: '#274845' }, {
    common: 'Розовый лотос', rare: 'Белый лотос', veryRare: 'Ночной лотос',
  }),
  biome(4, 'tea', 'Чайный сад', { fill: '#5a6a32', fillAlt: '#6a7c3c', stroke: '#3a4520' }, {
    common: 'Чайный куст', rare: 'Цветущий чай', veryRare: 'Древний чайный куст',
  }),
  biome(5, 'blossom', 'Сад цветения', { fill: '#8a5a66', fillAlt: '#9a6a76', stroke: '#5a3842' }, {
    common: 'Розовая сакура', rare: 'Белая сакура', veryRare: 'Плакучая сакура',
  }),
  biome(6, 'peony', 'Пионовый двор', { fill: '#7a4460', fillAlt: '#8c5470', stroke: '#4c283c' }, {
    common: 'Розовый пион', rare: 'Алый пион', veryRare: 'Древовидный пион',
  }),
  biome(7, 'chrysanthemum', 'Сад хризантем', { fill: '#8a7230', fillAlt: '#9c8440', stroke: '#544420' }, {
    common: 'Жёлтая хризантема', rare: 'Белая хризантема', veryRare: 'Тёмная хризантема',
  }),
  biome(8, 'pine', 'Сосновая роща', { fill: '#2f4a36', fillAlt: '#3c5c44', stroke: '#1c2e22' }, {
    common: 'Садовая сосна', rare: 'Изогнутая сосна', veryRare: 'Древний бонсай',
  }),
  biome(9, 'persimmon', 'Сад хурмы', { fill: '#8a4e28', fillAlt: '#9c5e38', stroke: '#543018' }, {
    common: 'Молодая хурма', rare: 'Плодовая хурма', veryRare: 'Древняя хурма',
  }),
  biome(10, 'orchid', 'Сад орхидей', { fill: '#5a4570', fillAlt: '#6c5682', stroke: '#382c48' }, {
    common: 'Пурпурная орхидея', rare: 'Белая орхидея', veryRare: 'Пятнистая орхидея',
  }),
  biome(11, 'berries', 'Ягодный сад', { fill: '#6a3040', fillAlt: '#7c4050', stroke: '#421820' }, {
    common: 'Ягодный куст', rare: 'Золотые ягоды', veryRare: 'Лунные ягоды',
  }),
  biome(12, 'rapeseed', 'Рапсовое поле', { fill: '#8a7c34', fillAlt: '#9c8e44', stroke: '#544c20' }, {
    common: 'Рапс', rare: 'Золотой рапс', veryRare: 'Белый рапс',
  }),
  biome(13, 'wheat', 'Пшеничное поле', { fill: '#7a6830', fillAlt: '#8c7840', stroke: '#4c4020' }, {
    common: 'Пшеница', rare: 'Золотая пшеница', veryRare: 'Церемониальная пшеница',
  }),
  biome(14, 'wisteria', 'Сад глициний', { fill: '#5a4870', fillAlt: '#6c5882', stroke: '#382c48' }, {
    common: 'Сиреневая глициния', rare: 'Белая глициния', veryRare: 'Каскадная глициния',
  }),
  biome(15, 'herbs', 'Сад лекарственных трав', { fill: '#3f5a40', fillAlt: '#4e6c4e', stroke: '#283828' }, {
    common: 'Лекарственные травы', rare: 'Цветущие травы', veryRare: 'Редкий женьшень',
  }),
]

export const HEX_BIOME_IDS = HEX_BIOMES.map((item) => item.id)

export const biomeById = new Map(HEX_BIOMES.map((item) => [item.id, item]))

export const plantById = new Map(
  HEX_BIOMES.flatMap((item) => [item.plants.common, item.plants.rare, item.plants.veryRare])
    .map((item) => [item.id, item]),
)

export function requireBiome(id: string): BiomeDefinition {
  const biomeDefinition = biomeById.get(id)
  if (!biomeDefinition) throw new Error(`Unknown hex biome ${id}`)
  return biomeDefinition
}

export function plantForRarity(biomeId: string, rarity: PlantRarity): PlantDefinition {
  return requireBiome(biomeId).plants[rarity]
}
