import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { assetUrl } from './assetUrl'
import './styles.css'

const rootStyle = document.documentElement.style
rootStyle.setProperty('--bg-garden-map', `url(${JSON.stringify(assetUrl('assets/garden-map.webp'))})`)

const root = createRoot(document.getElementById('root')!)
const isGardenRevealPrototype = import.meta.env.DEV && window.location.pathname === '/prototype/garden-reveal'
const isAnimationDebugPage = import.meta.env.DEV && window.location.pathname === '/debug/animations'

if (isAnimationDebugPage) {
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
