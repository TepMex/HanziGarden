import rawGraphics from '../../data/component-graphics.json'

type ComponentGraphic = {
  glyph: string
  fileName: string
}

const graphicPathByGlyph = new Map(
  (rawGraphics as ComponentGraphic[]).map((graphic) => [
    graphic.glyph,
    `assets/components/${graphic.fileName}.svg`,
  ]),
)

export function componentGraphicPath(glyph: string): string | null {
  return graphicPathByGlyph.get(glyph) ?? null
}
