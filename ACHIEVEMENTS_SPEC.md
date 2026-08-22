# Спецификация: система достижений

## 0. Задача

Реализовать полноценную achievement system для Hanzi Garden.

Цель системы:

* создавать долгосрочные цели;
* отмечать реальные milestones обучения;
* поощрять аккуратность и возвращение;
* создавать неожиданные memorable moments;
* давать коллекционную мета-прогрессию;
* не ломать XP-экономику.

Achievements **не должны быть ещё одним источником XP**.

Главная награда:

* achievement badge;
* название;
* описание;
* unlock animation;
* заполнение коллекции достижений.

---

# 1. Основной принцип

Achievement — постоянный unlock.

После получения:

```text
unlocked = true
unlockedAt = timestamp
```

Achievement нельзя потерять.

Даже если:

* daily streak позже сбросился;
* лучший Combo не повторился;
* игрок долго не заходил.

---

# 2. XP за достижения

По умолчанию:

```text
achievementXpReward = 0
```

Не давать XP за достижения.

Причина:

основная XP-экономика должна оставаться чистой:

```text
правильные штрихи
- ошибки
+ небольшой Combo bonus
```

Achievement badge сам является наградой.

---

# 3. Визуальный стиль

Использовать существующий стиль игры.

Achievement popup должен выглядеть как часть текущего `Сада иероглифов`, а не как generic mobile-game overlay.

Рекомендуемая композиция:

```text
[background gameplay slightly darkened]

     [маленькая красная печать]

     ДОСТИЖЕНИЕ
       ПОЛУЧЕНО

     ТВЁРДАЯ РУКА

  10 иероглифов подряд
       без ошибок

        [BADGE]

      [Продолжить]
```

Стиль:

* пергамент;
* тонкое золото;
* тёмно-зелёные элементы;
* serif typography;
* китайский botanical motif;
* небольшое количество petals / sparkles;
* premium, restrained celebration.

---

# 4. Использование генерации изображений

Codex должен использовать доступные ему image-generation skills.

Перед созданием badges:

1. исследовать существующие игровые assets;
2. определить palette и формы;
3. использовать существующий UI как reference;
4. создать единый achievement badge system.

Не генерировать каждый badge в случайном стиле.

Нужно создать визуальную систему.

Например:

```text
круглый медальон
+
центральная пиктограмма
+
botanical ornament
+
тонкая золотая рамка
```

Категории могут различаться центральным символом:

```text
Combo       → кисть / вспышка / рука
Daily       → росток / календарный цветок
Biome       → локальный символ биома
Session     → часы / солнце
Writing     → кисть / чернильный штрих
Statistics  → семена / листья
Recovery    → новый росток
Secret      → необычный декоративный символ
```

Сгенерировать сначала visual sheet с 6–10 badges одного семейства, проверить стилистическую консистентность, затем создавать остальные.

Использовать SVG/CSS для простых элементов, если полноценное raster изображение не требуется.

---

# 5. Achievement data model

Минимально:

```ts
type AchievementId = string;

interface AchievementDefinition {
  id: AchievementId;
  category:
    | 'daily'
    | 'combo'
    | 'biome'
    | 'session'
    | 'writing'
    | 'statistics'
    | 'recovery'
    | 'secret';

  title: string;
  description: string;

  secret: boolean;

  iconAsset?: string;

  progressType:
    | 'boolean'
    | 'counter'
    | 'max'
    | 'streak';

  target?: number;
}
```

Состояние пользователя:

```ts
interface AchievementState {
  id: AchievementId;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
}
```

---

# 6. Achievement engine

Не размещать achievement checks вручную в десятках UI-компонентов.

Сделать централизованный achievement engine.

Он подписывается на domain events.

Пример:

```text
app.opened
session.started
session.ended

stroke.correct
stroke.error

kanji.started
kanji.completed

combo.changed
combo.broken

gardenBed.completed
biome.completed

xp.earned
```

Achievement engine:

1. принимает event;
2. обновляет counters;
3. проверяет eligibility;
4. unlock-ит achievement;
5. ставит achievement в очередь UI notifications.

---

# 7. Очередь achievement popup

Если одновременно разблокировано несколько achievements:

не показывать несколько fullscreen popup одновременно.

Создать очередь:

```text
achievementQueue
```

Показывать последовательно.

Можно:

* показать первый полноценным popup;
* остальные затем показать один за другим;
* либо после первого использовать compact notification.

Для первой версии допустимо последовательно показывать полноценные cards.

---

# 8. Daily streak

Daily streak считается по календарным дням пользователя.

Нужно хранить:

```text
lastActiveDate
currentDailyStreak
bestDailyStreak
```

День считается посещённым после meaningful activity.

Не достаточно просто открыть приложение и сразу закрыть.

Предпочтительно считать день активным после хотя бы одного завершённого kanji.

---

# 9. Daily streak achievements

Реализовать:

### `daily_3`

**Росток**

```text
Заниматься 3 дня подряд.
```

### `daily_7`

**Привычка**

```text
Заниматься 7 дней подряд.
```

### `daily_14`

**Садовник**

```text
Заниматься 14 дней подряд.
```

### `daily_30`

**Месяц без засухи**

```text
Заниматься 30 дней подряд.
```

### `daily_90`

**Сезон**

```text
Заниматься 90 дней подряд.
```

### `daily_180`

**Полгода в поле**

```text
Заниматься 180 дней подряд.
```

### `daily_365`

**Год урожая**

```text
Заниматься 365 дней подряд.
```

---

# 10. Achievement за возвращение

### `return_after_30_days`

**Возвращение**

```text
Вернуться в Сад после перерыва не менее 30 дней.
```

Это achievement не за идеальный streak, а за возвращение после выпадения из привычки.

Важно сохранить его.

---

# 11. Combo achievements

Combo определяется системой XP:

> количество полностью безошибочно написанных подряд kanji.

Реализовать:

### `combo_5`

**Твёрдая рука**

```text
Написать 5 иероглифов подряд без ошибок.
```

### `combo_10`

**Не дрогнул**

```text
Написать 10 иероглифов подряд без ошибок.
```

### `combo_20`

**На автомате**

```text
Написать 20 иероглифов подряд без ошибок.
```

### `combo_50`

**Каллиграф**

```text
Написать 50 иероглифов подряд без ошибок.
```

### `combo_100`

**Без единой ошибки**

```text
Написать 100 иероглифов подряд без ошибок.
```

### `combo_250`

**Машина**

```text
Написать 250 иероглифов подряд без ошибок.
```

Сделать `combo_250` secret achievement.

---

# 12. Идеальная грядка

### `perfect_bed`

**Идеальная грядка**

```text
Полностью очистить одну грядку, не допустив ни одной ошибки.
```

Ошибка в любом kanji внутри грядки делает попытку неидеальной.

---

# 13. Биомы

В игре 15 полей/биомов.

Каждый биом должен иметь отдельное achievement.

Не придумывать названия биомов без проверки проекта.

Codex должен:

1. найти реальные определения всех 15 биомов в repo/data;
2. получить их реальные названия;
3. создать achievement для каждого;
4. сделать название achievement тематическим для конкретного биома;
5. использовать визуальный мотив конкретного биома в badge.

Структура ID:

```text
biome_01_complete
biome_02_complete
...
biome_15_complete
```

Описание:

```text
Полностью очистить <Название биома>.
```

---

# 14. Общие milestones по биомам

Дополнительно:

### `biomes_1`

**Земледелец**

```text
Полностью очистить первый биом.
```

### `biomes_5`

**Путешественник**

```text
Полностью очистить 5 биомов.
```

### `biomes_10`

**За горизонтом**

```text
Полностью очистить 10 биомов.
```

### `biomes_15`

**Хозяин земли**

```text
Полностью очистить все 15 биомов.
```

Последний badge должен визуально ощущаться как один из главных achievements игры.

---

# 15. Длительность активной сессии

Считать **active play time**, а не wall-clock время открытого приложения.

Если пользователь не взаимодействовал с приложением примерно 2–3 минуты:

```text
active session timer pauses
```

При возобновлении interaction:

```text
timer resumes
```

---

# 16. Session duration achievements

### `session_15m`

**Размялся**

```text
Провести 15 минут активной практики за одну сессию.
```

### `session_30m`

**Вошёл в ритм**

```text
Провести 30 минут активной практики за одну сессию.
```

### `session_60m`

**Час в поле**

```text
Провести 60 минут активной практики за одну сессию.
```

### `session_90m`

**Не разгибая спины**

```text
Провести 90 минут активной практики за одну сессию.
```

### `session_120m`

**Сегодня всё поле моё**

```text
Провести 120 минут активной практики за одну сессию.
```

Не добавлять achievements за более длинные сессии.

Не создавать achievements за игру ночью, в 03:00 и т.п.

---

# 17. Achievements за чистое письмо

### `perfect_10_kanji`

**Без помарок**

```text
Написать 10 иероглифов без единой ошибки.
```

Если это полностью дублирует `combo_10`, можно объединить achievement с Combo и не создавать дубликат.

Не должно существовать двух achievements за абсолютно одно и то же событие.

---

# 18. Сложные иероглифы

### `perfect_15_stroke_kanji`

**Сложный характер**

```text
Идеально написать иероглиф, состоящий минимум из 15 штрихов.
```

### `perfect_20_stroke_kanji`

**Тяжёлая артиллерия**

```text
Идеально написать иероглиф, состоящий минимум из 20 штрихов.
```

### `perfect_10_complex_kanji`

**Хирургическая точность**

```text
Идеально написать 10 иероглифов, каждый из которых содержит не менее 15 штрихов.
```

Это lifetime counter, иероглифы не обязаны идти подряд.

---

# 19. Achievement за упорство

### `finish_after_10_errors`

**Упрямее сорняка**

```text
Завершить один иероглиф, допустив не менее 10 ошибок.
```

Secret achievement.

Он должен превращать неудачную попытку в смешной memorable moment.

---

# 20. Lifetime: уничтоженные сорняки

Сорняк соответствует успешно завершённому kanji.

Реализовать milestones:

```text
100
500
1 000
5 000
10 000
```

Не использовать названия:

```text
Bronze
Silver
Gold
```

Создать отдельные тематические названия.

Codex может самостоятельно подобрать названия в стиле мира игры после анализа существующих текстов проекта.

Примерное направление:

```text
Первые всходы
Работа кипит
Опытный садовник
...
```

Но финальные названия должны соответствовать tone of voice приложения.

---

# 21. Lifetime: правильные штрихи

### `correct_strokes_1000`

**Тысяча штрихов**

```text
Выполнить 1 000 правильных штрихов.
```

### `correct_strokes_10000`

**Десять тысяч движений**

```text
Выполнить 10 000 правильных штрихов.
```

### `correct_strokes_100000`

**Сто тысяч штрихов**

```text
Выполнить 100 000 правильных штрихов.
```

---

# 22. Achievements, связанные с ошибками

Ошибка не должна восприниматься системой только как punishment.

Добавить несколько achievements, превращающих ошибки в игровые истории.

### `first_error`

**Это была разминка**

```text
Допустить первую ошибку.
```

Можно сделать secret.

### `five_errors_one_kanji`

**Методом исключения**

```text
Допустить минимум 5 ошибок на одном иероглифе и всё-таки завершить его.
```

### `recover_after_combo_20`

**Не сегодня**

Условие:

```text
потерять Combo >= 20
затем в той же сессии достичь нового Combo >= 10
```

### `recover_after_bad_run`

**Второе дыхание**

Условие:

```text
три завершённых подряд kanji содержали хотя бы одну ошибку каждый
после этого написать 5 kanji подряд идеально
```

---

# 23. Rare / secret achievements

### `error_on_final_stroke`

**На последнем штрихе**

```text
Впервые ошибиться в иероглифе именно на его последнем требуемом штрихе.
```

Secret.

### `break_combo_49`

**Ну почти**

```text
Потерять Combo на значении 49.
```

Secret.

Важно:

событие означает, что текущий combo перед ошибкой был `49`.

---

# 24. Идеальный день

### `perfect_day`

**Идеальный день**

```text
За один календарный день полностью очистить несколько грядок,
не допустив ни одной ошибки.
```

Конкретный threshold `N` не придумывать вслепую.

Codex должен:

1. проверить типичный размер грядки;
2. проверить нормальную длину игровой сессии;
3. выбрать разумный threshold;
4. вынести его в configuration.

Стартовый вариант для тестирования:

```text
N = 3 грядки
```

---

# 25. Ровно 100 XP

### `exact_100_xp_bed`

**Ровно в цель**

```text
Закончить одну грядку, заработав за неё ровно 100 XP.
```

Учитывать:

```text
base XP
ошибки
Combo bonuses
```

то есть итоговое значение session/bed XP.

Secret achievement.

---

# 26. Минимальный XP за иероглиф

### `one_xp_kanji`

**Один XP**

```text
Завершить иероглиф, получив за него минимально возможные +1 XP.
```

Secret achievement.

---

# 27. Первая идеальная грядка

Если `perfect_bed` используется как одноразовый achievement, отдельный achievement не нужен.

Если хочется tiering, можно использовать:

### `first_perfect_bed`

**С чистого листа**

```text
Впервые идеально очистить грядку.
```

Не создавать одновременно `Идеальная грядка` и `С чистого листа` с полностью одинаковым условием.

Выбрать одно.

Предпочтительное название:

```text
С чистого листа
```

---

# 28. 10 грядок за сессию

### `ten_beds_session`

**Комбайн**

```text
Очистить 10 грядок за одну игровую сессию.
```

Считать только реально завершённые грядки.

---

# 29. Список achievement categories

Итоговые группы:

```text
Daily
Combo
Biomes
Session
Writing
Statistics
Recovery
Secrets
```

UI коллекции должен позволять группировать badges по этим категориям.

---

# 30. Secret achievements

Secret achievement до unlock отображать как:

```text
???
```

или:

```text
Скрытое достижение
```

Не раскрывать точное условие.

После unlock:

* показать настоящее название;
* показать описание;
* показать badge.

Secret:

```text
Combo 250
Упрямее сорняка
Это была разминка (опционально)
На последнем штрихе
Ну почти
Ровно в цель
Один XP
```

Codex может сделать ещё 2–3 secrets, только если они естественно следуют из существующей механики.

Не раздувать систему искусственно.

---

# 31. Achievement popup animation

Когда achievement unlock-нут:

1. gameplay/map background слегка затемняется;
2. небольшой warm glow;
3. parchment card появляется через scale + fade;
4. badge появляется отдельно;
5. короткий particle effect:

   * несколько искр;
   * лепестки;
   * или листья;
6. title появляется после badge;
7. доступна кнопка `Продолжить`.

Продолжительность:

```text
примерно 1–2 секунды до fully readable state
```

Игрок должен иметь возможность быстро закрыть popup.

Не делать длинную unskippable animation.

---

# 32. Achievement list screen

Если в проекте ещё нет места для achievements:

сначала исследовать текущую навигацию.

Предпочтительно встроить достижения в существующий экран статистики, а не создавать ещё одну крупную кнопку на главной карте.

Например:

```text
Статистика
├── Общая
├── Достижения
└── ...
```

Главную карту не перегружать.

---

# 33. Карточка achievement в коллекции

Состояние locked:

```text
[badge silhouette]
Название / ???
Описание progress
```

Состояние unlocked:

```text
[full badge]
Название
Описание
Дата получения
```

Для progression achievements отображать:

```text
37 / 50
```

если это не secret achievement.

---

# 34. Биомные badges

Для каждого из 15 биомов Codex должен использовать свои навыки создания изображений.

Workflow:

1. найти visual asset соответствующего биома;
2. определить его уникальный визуальный мотив;
3. сгенерировать маленький badge/emblem;
4. сохранить общую форму badge одинаковой;
5. менять только центральный motif и небольшие secondary details.

Пример:

```text
бамбуковый биом → bamboo leaves
цветочный → blossom
каменный → stone gate
болотный → lotus/reeds
...
```

Но использовать реальные биомы из проекта.

---

# 35. Persistence

Минимально хранить:

```ts
interface AchievementPersistence {
  unlockedAchievements: {
    id: string;
    unlockedAt: string;
  }[];

  currentDailyStreak: number;
  bestDailyStreak: number;
  lastActiveDate?: string;

  bestComboEver: number;

  lifetimeCorrectStrokes: number;
  lifetimeErrors: number;
  lifetimeCompletedKanji: number;
  lifetimeCompletedBeds: number;
  lifetimeCompletedBiomes: number;

  perfectComplexKanjiCount: number;
}
```

Если проект уже имеет statistics store, переиспользовать его.

Не создавать дублирующие counters.

---

# 36. Existing user migration

Для существующих игроков:

необходимо решить, какие achievements выдаются retroactively.

Рекомендация:

## Выдавать retroactively, если данные существуют

Например:

```text
1000 correct strokes
5000 kanji
completed biome
```

## Не выдавать, если исторически доказать условие невозможно

Например:

```text
ровно 100 XP за грядку
ошибка на последнем штрихе
Combo 49 broken
```

Нельзя угадывать.

---

# 37. Duplicate prevention

Unlock должен быть idempotent.

```text
unlockAchievement(id)
```

при повторном вызове:

* не создаёт второй unlock;
* не показывает второй popup;
* не изменяет `unlockedAt`.

---

# 38. Offline

Achievement system должна полностью работать offline.

Никакой server dependency для определения unlock не требуется, если архитектура игры локальная.

При последующей синхронизации не должно возникать дубликатов.

---

# 39. Telemetry

Если в проекте уже есть analytics, отправлять:

```text
achievement_unlocked
achievement_popup_shown
achievement_popup_closed
```

С payload:

```text
achievementId
category
currentLevel
sessionDuration
```

Не добавлять analytics SDK только ради этой задачи.

---

# 40. Tests

Обязательно протестировать:

## Daily

```text
1 day → streak 1
next day → streak 2
same day → не увеличивается
skip one full day → streak resets
30+ days absent → Return achievement
```

Учитывать timezone.

## Combo

Пороговые значения:

```text
5
10
20
50
100
250
```

## Perfect bed

Одна ошибка делает attempt non-perfect.

## Session time

Idle time не считается.

## Complex kanji

Точно проверяется stroke count.

## Error achievements

Проверить state machine recovery achievements.

## Exact XP

```text
99 → no achievement
100 → unlock
101 → no achievement
```

## Idempotency

Одно событие не unlock-ит achievement дважды.

---

# 41. Не реализовывать

Не добавлять:

* achievement XP rewards;
* loot boxes;
* coins;
* paid badge variants;
* achievements за просмотр рекламы;
* achievements за покупку;
* achievements за запуск приложения ночью;
* achievements за чрезмерно длинные сессии >120 минут;
* наказание за потерю daily streak;
* удаление achievement после потери streak;
* 200+ бессодержательных achievements.

---

# 42. Итоговый ориентир по количеству

Целевая система:

```text
15 biome achievements
7 daily streak achievements
1 return achievement
6 combo achievements
4 biome milestone achievements
5 session duration achievements
3 complex-writing achievements
3 correct-stroke milestones
5 weed/kanji-count milestones
3–4 recovery achievements
5–8 secret/funny achievements
несколько special session achievements
```

Ориентир:

```text
примерно 55–70 achievements
```

Но финальное количество определяется после дедупликации условий.

Не создавать две ачивки за абсолютно одно и то же действие только ради количества.

---

# 43. Acceptance criteria

Система считается готовой, если:

* achievement definitions централизованы;
* unlock logic отделена от UI;
* состояние сохраняется;
* повторный unlock невозможен;
* daily streak работает с календарными днями;
* active session time исключает idle;
* Combo achievements используют ту же Combo-логику, что XP system;
* 15 реальных биомов имеют собственные achievements;
* secret achievements скрывают условия до unlock;
* achievements не дают XP;
* popup выполнен в стилистике игры;
* имеется коллекция/список достижений;
* прогресс counter-achievements отображается;
* существующие исторические данные мигрируются только там, где факт можно доказать;
* Codex использует image-generation skills для создания согласованного набора achievement badges и необходимых decorative assets.
