import { assetUrl } from './assetUrl'
import { componentGraphicPath } from './data/componentGraphics'

export function ComponentGlyph({ hanzi }: { hanzi: string }) {
  const graphicPath = componentGraphicPath(hanzi)
  return (
    <span className="component-hanzi" aria-hidden="true">
      {graphicPath
        ? <img src={assetUrl(graphicPath)} alt="" />
        : hanzi}
    </span>
  )
}
