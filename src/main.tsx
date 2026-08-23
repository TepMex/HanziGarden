import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { assetUrl } from './assetUrl'
import './styles.css'

const rootStyle = document.documentElement.style
rootStyle.setProperty('--bg-garden-map', `url(${JSON.stringify(assetUrl('assets/garden-map.webp'))})`)

const root = createRoot(document.getElementById('root')!)
const isGardenRevealPrototype = import.meta.env.DEV && window.location.pathname === '/prototype/garden-reveal'
const isBiomeBadgesPrototype = import.meta.env.DEV && window.location.pathname === '/prototype/biome-badges'
const isKeywordPromptsPrototype = import.meta.env.DEV && window.location.pathname === '/prototype/keyword-prompts'
const isContentEditor = import.meta.env.DEV && window.location.pathname === '/prototype/content-editor'
const isScreenSpreadPrototype = import.meta.env.DEV && window.location.pathname === '/prototype/screen-spread'
const isAnimationDebugPage = import.meta.env.DEV && window.location.pathname === '/debug/animations'

if (isScreenSpreadPrototype) {
  import('./prototype/ScreenSpreadPrototype').then(({ ScreenSpreadPrototype }) => {
    root.render(
      <StrictMode>
        <ScreenSpreadPrototype />
      </StrictMode>,
    )
  })
} else if (isContentEditor) {
  import('./contentEditor/ContentEditor').then(({ ContentEditor }) => {
    root.render(
      <StrictMode>
        <ContentEditor />
      </StrictMode>,
    )
  })
} else if (isKeywordPromptsPrototype) {
  import('./prototype/KeywordPromptsPrototype').then(({ KeywordPromptsPrototype }) => {
    root.render(
      <StrictMode>
        <KeywordPromptsPrototype />
      </StrictMode>,
    )
  })
} else if (isBiomeBadgesPrototype) {
  import('./prototype/BiomeBadgesPrototype').then(({ BiomeBadgesPrototype }) => {
    root.render(
      <StrictMode>
        <BiomeBadgesPrototype />
      </StrictMode>,
    )
  })
} else if (isAnimationDebugPage) {
  import('./debug/AnimationDebugPage').then(({ AnimationDebugPage }) => {
    root.render(
      <StrictMode>
        <AnimationDebugPage />
      </StrictMode>,
    )
  })
} else if (isGardenRevealPrototype) {
  import('./prototype/GardenRevealPrototype').then(({ GardenRevealPrototype }) => {
    root.render(
      <StrictMode>
        <GardenRevealPrototype />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
