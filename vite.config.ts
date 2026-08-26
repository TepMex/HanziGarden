import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isHsk1 = mode === 'hsk1'
  const branding = isHsk1
    ? {
        title: 'Hanzi Garden HSK 1',
        description: 'Hanzi Garden HSK 1 — версия игры на 220 иероглифов HSK 1–2 (2.0)',
        favicon: '/assets/hsk1/favicon-32x32.png',
        touchIcon: '/assets/hsk1/apple-touch-icon.png',
      }
    : {
        title: 'Hanzi Garden',
        description: 'Hanzi Garden — игра о написании китайских иероглифов',
        favicon: '/favicon-32x32.png',
        touchIcon: '/apple-touch-icon.png',
      }

  /** Project Pages base, e.g. `/HanziGarden/` or `/HanziGarden/hsk1/` (see CI). */
  const base = process.env.GH_PAGES_PUBLIC_PATH?.replace(/\/?$/, '/') ?? './'

  return {
    plugins: [
      react(),
      {
        name: 'hanzi-garden-branding',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            return html
              .replace('__APP_TITLE__', branding.title)
              .replace('__APP_DESCRIPTION__', branding.description)
              .replace('__APP_FAVICON__', branding.favicon)
              .replace('__APP_TOUCH_ICON__', branding.touchIcon)
          },
        },
      },
    ],
    base,
  }
})
