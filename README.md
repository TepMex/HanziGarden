# Сад памяти / Memory Garden

Игровой MVP по `GAME_SPEC.md`, `GAME_CONCEPT.md` и `V2_SPEC.md`: значение → самостоятельное написание иероглифа → каждый правильный штрих повреждает сорняк → завершённый знак обновляет FSRS и здоровье участка.

Этот репозиторий содержит **только** Memory Garden:

| Путь | Содержимое |
| ---- | ---------- |
| `/` (корень) | Веб-игра (React + Vite + TypeScript) |
| `android/` | Sideload Android APK — тонкая Kotlin/WebView-оболочка с бандлом той же веб-сборки |

Это не монорепозиторий с другими проектами: веб и Android живут рядом в одном репо.

Спеки: [`GAME_SPEC.md`](./GAME_SPEC.md), [`GAME_CONCEPT.md`](./GAME_CONCEPT.md), [`V2_SPEC.md`](./V2_SPEC.md), [`android/SPEC.md`](./android/SPEC.md).

## Запуск (веб)

```bash
bun install
bun run dev
```

Production-сборка:

```bash
bun run build
```

## Android

Сборка APK из корня репозитория (скрипт берёт веб из `..` относительно `android/` — то есть этот же корень):

```bash
cd android
./scripts/sync-web-assets.sh
./gradlew assembleRelease
```

Подробности: [`android/README.md`](./android/README.md).

## GitHub Pages

Workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) на push в `master` собирает веб и при необходимости Android из **этого** репозитория.

- Веб-игра: `https://<user-or-org>.github.io/<repository>/`
- Android landing + APK: `https://<user-or-org>.github.io/<repository>/android/` → `rth-agriculture-android.apk`

CI может задать `GH_PAGES_PUBLIC_PATH` (например `/<repository>/`), чтобы Vite выставил корректные абсолютные URL ассетов. Для локальной/`file://` сборки и Android-обёртки переменную не задают — `base` остаётся `./`.

Фоновые изображения задаются абсолютными URL из `document.baseURI` (`src/assetUrl.ts`), чтобы CSS `url(var(--bg-*))` не пересчитывал `./assets/...` относительно хешированного CSS (иначе в Android WebView получается `assets/assets/...` и 404).

Карта и battle-арт идут как **WebP** (отдельный набор backdrop’ов на каждый из 15 садов), чтобы APK оставался под лимитом GitHub 100 MB и полностью офлайн.

Stroke JSON для Hanzi грузится через **XHR** (`src/hanziData.ts`), не через `fetch` — Chromium/Android WebView отклоняют Fetch на `file://`, из‑за чего quiz/подсказки в APK не работали.

## Tests

```bash
bun test
bun run test:battle-background
# After `vite build --outDir /tmp/rth-www` + static server on :8765:
bun run test:battle-canvas
# file:// input (Android-shaped):
bun run test:battle-input
```

## Что реализовано

- один масштабируемый мир из 15 садовых культур и 220 игровых участков;
- каждый из 110 уникальных списков RSH разделён на две последовательные половины без перестановки кадров;
- логическая сетка 15×15; первые пять участков занимают по две ячейки и дают более заметное раннее восстановление;
- управление RTS-картой: pan мышью/touch, cursor-centered wheel zoom, pinch zoom, возврат из боя к той же камере;
- 2974 иероглифа без книжных мнемонических историй в production-данных;
- локальные stroke-данные для всех 2974 знаков;
- Hanzi Writer в режиме quiz: порядок, направление и положение штриха;
- подсказка только для следующего штриха после ошибок или по запросу;
- урон сорняку за каждый принятый штрих и уничтожение после полного знака;
- FSRS через `ts-fsrs`, оценки `Again`/`Good` независимо от анимации боя;
- здоровье участка по взвешенной сумме штрихов due/new карточек и blending полной clean/negative карты;
- постоянные открытия соседних участков и изменяемое состояние зарастания;
- IndexedDB-сохранение через Dexie с без потерь миграцией v1 полей в две v2-половины;
- отдельная статистика: плотная стена всех иероглифов и цветовая проекция SRS-стадий;
- мышь, touch и pen Pointer Events через Hanzi Writer;
- адаптивные desktop/mobile интерфейсы;
- Android WebView APK с офлайн-бандлом той же сборки (`android/`).

Сгенерированные проектные фоны находятся в `public/assets/`. Исходные референсы сохранены в `concept-art/`.
