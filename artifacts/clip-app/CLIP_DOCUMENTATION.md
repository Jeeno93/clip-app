# Clip — документация

## AI-анализ

Clip умеет создавать конспекты статей и текстов через пользовательский API ключ. Поддерживается пять провайдеров, ключи хранятся локально в AsyncStorage и никуда не отправляются кроме выбранного провайдера.

### Провайдеры

| Провайдер | Модель | Цена | Где взять ключ |
|-----------|--------|------|----------------|
| DeepSeek | `deepseek-chat` | Доступен в РФ | platform.deepseek.com |
| YandexGPT | `yandexgpt-lite` | Рубли, РФ | console.yandex.cloud |
| Google Gemini | `gemini-2.0-flash` | Бесплатно (с лимитом) | aistudio.google.com |
| Anthropic Claude | `claude-haiku-4-5-20251001` | Платно | console.anthropic.com |
| OpenAI | `gpt-4o-mini` | Платно | platform.openai.com |

Порядок карточек в настройках: **DeepSeek → YandexGPT → Gemini → Claude → OpenAI**.

YandexGPT дополнительно требует **FolderID** (хранится отдельно под ключом `@clip:yandex_folder_id`). Поле появляется только при выборе YandexGPT и сохраняется вместе с API ключом по нажатию «Сохранить».

### Настройки (Настройки → AI-анализ)

1. **Провайдер** — карточки в сетке, активная подсвечена янтарной рамкой.
2. **API ключ** — поле ввода (secure), для YandexGPT дополнительное поле FolderID. Кнопка «Сохранить» с подтверждением «Ключ сохранён ✓» (или «Ключ и FolderID сохранены ✓» для YandexGPT). Подсказка где получить ключ зависит от провайдера.
   - **Ключи всех провайдеров хранятся одновременно** в `Settings.aiKeys` (`{ gemini, claude, openai, deepseek, yandex }`). При переключении провайдера в поле ввода автоматически подставляется ранее сохранённый ключ для нового провайдера. Сохранение ключа одного провайдера не затирает ключи остальных.
   - Статус «Ключ сохранён ✓» показывается всё время, пока для активного провайдера есть сохранённый ключ — не только сразу после сохранения.
3. **Глубина анализа**:
   - `Быстро` — 1-2 предложения на пункт
   - `Стандарт` — 2-4 предложения на пункт
   - `Глубоко` — без ограничений
4. **Что включать** — переключатели для модулей промпта:
   - Ключевые идеи (по умолчанию ВКЛ)
   - Объяснение терминов (по умолчанию ВКЛ)
   - Взгляд AI на материал
   - Вопросы для размышления
   - Практическое применение

Все настройки кроме API ключа сохраняются автоматически при изменении. Запись в `@clip:settings` сериализована через очередь промисов, поэтому быстрые подряд идущие изменения не теряются.

### Использование

В карточке идеи:

- Кнопка **«✦ Анализировать»** появляется, если задан API ключ И карточка содержит превью ссылки или текст длиннее 200 символов.
- При входе на экран карточки настройки AI перечитываются (`useFocusEffect`) — изменения в настройках применяются сразу при возврате назад.
- Стиль кнопки совпадает с «Удиви меня»: фон `accentSubtle`, граница `accentDim`, текст `accent`.
- Во время запроса кнопка показывает индикатор и текст «Анализирую…».
- **Выбор текста для анализа** (приоритет): `linkPreview.fullText` → `linkPreview.description` → `clip.text`. Итоговый текст обрезается до 6000 символов, чтобы не превышать лимиты токенов провайдеров.
- Если все модули анализа выключены → Alert «Включи хотя бы один модуль анализа в настройках AI» (без обращения к API).

### Индикатор качества данных

Под кнопкой «Анализировать» (только для карточек со ссылкой):

- ✓ **«Полный текст статьи загружен»** — если `linkPreview.fullText` существует и длиннее 500 символов.
- ⚠ **«Только превью — анализ может быть неточным»** — если полного текста нет либо он слишком короткий.

Для карточек без ссылки индикатор не показывается.

### Извлечение полного текста статьи

При сохранении ссылки `fetchLinkPreview` дополнительно извлекает основной текст страницы:

- Удаляются теги `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<figure>` вместе с содержимым.
- Основной контент ищется в порядке приоритета: `<article>` → `<main>` → весь оставшийся HTML.
- Все остальные теги вырезаются, HTML-сущности декодируются, пробелы нормализуются.
- Результат обрезается до **8000 символов** и сохраняется в `linkPreview.fullText` (опциональное поле). При анализе используется первые 6000 символов.

Полный текст хранится локально вместе с самой карточкой в `@clip:clips` и используется только для AI-анализа.

### Блок конспекта

После успешного анализа показывается блок:

- Заголовок «✦ AI-анализ» (accent, semibold)
- Справа — две кнопки: **«↗ Поделиться анализом»** (вызывает системный share с текстом конспекта; заголовок — `linkPreview.title` или «Анализ из Clip») и **«Обновить»** (повторный запрос). Обе оформлены как мелкий `textMuted` 11px.
- Тело конспекта с простым парсером markdown: строки вида `**заголовок**` рендерятся жирным, остальные — обычным текстом.
- Сохранённый конспект отображается сразу при следующем открытии карточки. Кнопка «Анализировать» при этом скрывается.

### Бейдж в списке

Если у карточки есть сохранённый конспект, в списке под содержимым показывается маленький бейдж **«✦ Есть AI-анализ»** (фон `accentSubtle`, текст `accentDim`). Сам текст конспекта в списке не показывается.

### Обработка ошибок

- HTTP 401/403 → Alert «Неверный API ключ. Проверь настройки.»
- Таймаут (30 секунд) / любая другая HTTP-ошибка → Alert «Ошибка AI: {текст}» (тело ответа провайдера).
- Для YandexGPT при отсутствии FolderID → Alert «Не указан FolderID для YandexGPT. Заполни его в настройках.»

### Технические детали

- Таймаут запросов ко всем провайдерам — **30 секунд**.
- Данные хранятся в `Settings.aiProvider | aiKeys | aiDepth | aiModules` (`@clip:settings`). `aiKeys` — объект со всеми ключами одновременно: `{ gemini, claude, openai, deepseek, yandex }`. Yandex FolderID — отдельным ключом `@clip:yandex_folder_id`. Конспект — в `Clip.summary` (`@clip:clips`). Полный текст статьи — в `Clip.linkPreview.fullText` (`@clip:clips`).
- **Миграция legacy `aiApiKey`:** при первом чтении настроек, если у пользователя сохранён старый строковой `aiApiKey` и выбран `aiProvider`, ключ автоматически переносится в `aiKeys[aiProvider]` (если там пусто). Поле `aiApiKey` отбрасывается при следующем сохранении.
- Логика суммаризации: `src/utils/summarize.ts` (`summarizeContent()`).
- Извлечение текста статьи: `src/utils/fetchLinkPreview.ts` (`extractFullText()`).
- Системный и пользовательский промпт собираются динамически из активных модулей и глубины.
- Логи: чувствительные данные (API ключи, тело запросов/ответов, URL с ключом) **не логируются**. В консоль выводится только `console.error("AI error:", msg)` для отладки.

## Storage

Ключи AsyncStorage:

| Ключ | Что хранит |
|------|------------|
| `@clip:clips` | Массив всех идей (`Clip[]`) |
| `@clip:streak` | Текущий streak (`{ count, lastDate }`) |
| `@clip:settings` | Настройки приложения |
| `@clip:daily_cards` | ID карточек сегодняшнего дня |
| `@clip:daily_date` | Дата последней генерации daily-карточек |
| `@clip:yandex_folder_id` | FolderID для YandexGPT |

## Голосовой ввод

На экране добавления (`app/add.tsx`) рядом с полем основного текста есть круглая кнопка микрофона (диаметр 48). Реализовано на пакете **`@react-native-voice/voice`**.

### Поведение

- В обычном состоянии — кружок с фоном `bgInput`, бордер `border` (1px) и иконкой 🎤 (20px).
- В режиме записи (`isListening = true`) — фон `accentSubtle`, бордер `accent` (2px), иконка ⏹. Кнопка пульсирует через `react-native-reanimated`: `opacity 1 → 0.5 → 1`, длительность 800мс, бесконечный реверс-цикл.
- Над полем текста, когда идёт запись, появляется строка **«● Говорите…»** (`accent`, 12px) с той же пульсацией.
- При ошибке распознавания — на месте этой строки 3 секунды показывается текст ошибки (`textMuted`, 12px), затем автоматически исчезает.
- При нажатии кнопки запускается `startListening()` (если не пишем) или `stopListening()` (если пишем). Перед `Voice.start("ru-RU")` запрашивается разрешение `RECORD_AUDIO` через `PermissionsAndroid.request(...)`. Если разрешение не дали — показывается Alert с объяснением.
- Распознанный текст добавляется к существующему через пробел (`prev + " " + transcript`).

### Источник

Если пользователь хотя бы раз нажал на кнопку записи (флаг `hasUsedVoice` стал `true`) — поле `source` сохраняемой карточки становится `"voice"`. Приоритет источников: `screenshot` > `link` > `voice` > переданный из share-intent / `manual`.

### Разрешения

В `app.json` для Android прописано `"permissions": ["android.permission.RECORD_AUDIO"]`. iOS-разрешения (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) пока не настроены — для iOS сборки их нужно будет добавить в `infoPlist`.

### ⚠️ Требуется development build

`@react-native-voice/voice` — нативный модуль, **не работающий в Expo Go**. Чтобы кнопка микрофона появилась в приложении, нужен dev build:

```bash
# через EAS
eas build --profile development --platform android

# или локально через prebuild
pnpm --filter @workspace/clip-app exec expo prebuild
pnpm --filter @workspace/clip-app exec expo run:android
```

В `app/add.tsx` импорт пакета обёрнут в `try { require(...) } catch {}` (флаг `VOICE_AVAILABLE`). На вебе и в Expo Go (где нативного модуля нет) кнопка микрофона просто **не отрисовывается**, остальная функциональность экрана не страдает.

## Заголовок карточки

У каждой идеи есть необязательное поле `title?: string` (макс. 100 символов).

- **При добавлении** (`app/add.tsx`) над полем текста есть лёгкое поле «Заголовок (необязательно)» — semibold 16px, прозрачный фон, нижняя подчёркивающая линия.
- **В списке/архиве** (`ClipCard`) если у клипа есть `title`, он показывается одной строкой (semibold 13px) над содержимым карточки — над картинкой, link-preview или текстом.
- **В детальном просмотре** (`app/clip/[id].tsx`) если есть `title`, он отображается крупно (bold 22px) первым элементом, выше изображения и link-preview. В режиме редактирования крупный заголовок скрывается, а в форме редактирования появляются **два поля**: компактный input для заголовка + основной textarea для текста. Кнопка «Сохранить» сохраняет оба поля одним вызовом `editClipText(id, text, title)`. Если поле заголовка очистили — `title` сохраняется как `undefined` (поле уходит).
- **Поиск в архиве** (`app/(tabs)/archive.tsx`) учитывает `title` так же, как `text` и теги (case-insensitive substring).
- Для клипов с `linkPreview` (где нет существующей кнопки «Редактировать» текста) пользовательский заголовок устанавливается только при создании.

### Особенности миграции и устойчивости

- **`getSettings()`** делает **deep-merge** для `aiModules`: если в сохранённых настройках отсутствует какой-то модуль (например, новый добавили в обновлении) — он автоматически дополняется значением из `DEFAULT_SETTINGS.aiModules`. Верхний уровень тоже спред-мерджится.
- **`saveSettings()`** сериализует все вызовы через очередь промисов (`saveQueue`). Параллельные вызовы выполняются последовательно и не перезаписывают друг друга.
- **`getDailyCards()`** даёт приоритет новым карточкам:
  1. Если сегодня (по UTC, поле `createdAt`) добавлено **3 и больше** идей — показываются три самых новых из них. Без фиксации на день — обновляется при каждом открытии.
  2. Если сегодня добавлено **1-2** идеи — они показываются вместе со случайными добранными из остального архива до 3 штук. Тоже без фиксации.
  3. Если сегодня **ничего не добавлено** — работает старая логика: 3 случайных из архива, фиксируются на день в `@clip:daily_cards` / `@clip:daily_date`. При возврате сохранённых на сегодня ID проверяется их существование в архиве; если что-то удалено — добираются случайные до целевого количества (`min(3, total)`) и `@clip:daily_cards` обновляется.
- **Streak** считается по UTC-датам (`new Date().toISOString().slice(0, 10)`), чтобы не зависеть от часового пояса устройства и переездов между ними.

## Структуры данных

### Clip

Интерфейс одной идеи (`src/storage/clips.ts`):

```ts
interface Clip {
  id: string;
  text: string;
  title?: string;                // необязательный заголовок, до 100 символов
  imageUri: string | null;       // путь к локальному изображению / скриншоту
  source: string;                // "manual" | "screenshot" | "link" | "voice" | значение из share-intent
  tags: string[];
  createdAt: string;             // ISO-строка
  domainId?: string;             // если не задан → клип во «Входящих»
  linkPreview?: {
    title: string;
    description: string | null;
    imageUrl: string | null;
    url: string;
    fullText?: string;           // текст статьи (до 8000 символов) для AI-анализа
  };
  summary?: string;              // сохранённый AI-конспект
}
```

- `title?` — отображается в `ClipCard` (semibold 13px), на детальном экране (bold 22px), участвует в поиске архива.
- `source = "voice"` ставится автоматически, если на экране добавления была нажата кнопка микрофона.
- `domainId?` — ссылка на `Domain.id`. Отсутствие или `undefined` означает, что клип лежит во **Входящих**. Подробнее см. раздел «Домены знаний».

### Domain

Папка для группировки идей по теме (`src/storage/clips.ts`):

```ts
interface Domain {
  id: string;          // авто-генерируемый
  name: string;        // название, до 30 символов
  icon: string;        // одна emoji-иконка
  createdAt: string;   // ISO-строка
}
```

Хранится отдельно от настроек под ключом **`@clip:domains`** для производительности (список настроек меняется иначе, чем список доменов).

### Settings

Хранится в `@clip:settings` (`src/storage/clips.ts`):

```ts
type AiProvider = "gemini" | "claude" | "openai" | "deepseek" | "yandex";
type AiDepth    = "quick" | "standard" | "deep";
type ThemeMode  = "dark" | "light" | "system";

interface AiKeys {
  gemini:   string | null;
  claude:   string | null;
  openai:   string | null;
  deepseek: string | null;
  yandex:   string | null;
}

interface AiModules {
  keyIdeas:      boolean;   // ВКЛ по умолчанию
  terms:         boolean;   // ВКЛ по умолчанию
  aiPerspective: boolean;
  questions:     boolean;
  practical:     boolean;
}

interface Settings {
  notificationHour: number | null;   // час напоминания (0-23) или null если выкл
  onboardingDone:   boolean;
  themeMode:        ThemeMode;
  aiProvider:       AiProvider | null;
  aiKeys:           AiKeys;          // ключи всех пяти провайдеров одновременно
  aiDepth:          AiDepth;
  aiModules:        AiModules;
}
```

**Важно про `aiKeys`:** заменил старое одиночное поле `aiApiKey` (строка). Теперь все ключи всех провайдеров хранятся одновременно — переключение провайдера не стирает ключ предыдущего. Старое поле `aiApiKey` мигрирует в `aiKeys[aiProvider]` при первом чтении настроек и далее отбрасывается.

### Все пять AI-провайдеров

| Ключ | Провайдер | Модель | Где брать ключ |
|------|-----------|--------|----------------|
| `deepseek` | DeepSeek | `deepseek-chat` | platform.deepseek.com |
| `yandex`   | YandexGPT | `yandexgpt-lite` | console.yandex.cloud (+ `@clip:yandex_folder_id`) |
| `gemini`   | Google Gemini | `gemini-2.0-flash` | aistudio.google.com |
| `claude`   | Anthropic Claude | `claude-haiku-4-5-20251001` | console.anthropic.com |
| `openai`   | OpenAI | `gpt-4o-mini` | platform.openai.com |

### Streak

```ts
interface Streak {
  count:    number;   // текущий счётчик
  lastDate: string;   // YYYY-MM-DD (UTC) последнего инкремента
}
```

## Экраны

### AddClipScreen (`app/add.tsx`)

Создание новой идеи. Поддерживает источники `manual`, `screenshot`, `link`, `voice`.

- **Заголовок (необязательно)** — компактный input semibold 16px с нижней подчёркивающей линией, лимит 100 символов. Сохраняется в `Clip.title`.
- **Текст идеи** — multiline textarea, 16px. Если открыт с `?sharedText=...` или со скриншотом, поведение меняется (не автофокусится при картинке).
- **Кнопка микрофона** (см. раздел «Голосовой ввод») — справа от поля текста, диаметр 48, активируется при нажатии. Реализована через `@react-native-voice/voice`. Требует разрешения `RECORD_AUDIO` на Android и **dev build** (в Expo Go и на вебе кнопка скрыта).
- **Превью ссылки** — если в тексте URL, асинхронно подгружается `fetchLinkPreview` и показывается карточка с картинкой/заголовком/описанием/доменом.
- **Превью изображения** — если открыт со `?imageUri=...`.
- **Теги** — `TagPicker` со всеми существующими тегами + ввод нового.
- **Источник (badge)** — показывается, если `source !== "manual"`. Приоритет: `screenshot` > `link` > `voice` > переданный из share-intent / `manual`.
- **Лимит free-версии** — если `clips.length >= FREE_LIMIT (100)`, поля недоступны и показывается красный баннер.

### ClipDetailScreen (`app/clip/[id].tsx`)

Детальный просмотр одной идеи.

- **Заголовок** — крупный (bold 22px) первым элементом, если `clip.title` задан и не в режиме редактирования.
- **Изображение / превью ссылки** — рендерится после заголовка.
- **Текст / цитата** — основной контент карточки.
- **Кнопка «Редактировать»** (только для не-link клипов) — открывает форму с двумя полями: компактный input заголовка + основной textarea текста. Сохраняется одним вызовом `editClipText(id, text, title)`. Очистка заголовка убирает `title` из хранилища.
- **«✦ Анализировать»** — появляется, если задан AI-ключ И есть `linkPreview` или текст длиннее 200 символов. Под кнопкой — индикатор качества данных («Полный текст статьи загружен» ✓ или «Только превью — анализ может быть неточным» ⚠).
- **Блок AI-анализа** — после успешной суммаризации:
  - заголовок «✦ AI-анализ» (accent, semibold);
  - **«↗ Поделиться анализом»** — справа в шапке блока, вызывает системный share с текстом конспекта (заголовок берётся из `linkPreview.title` или fallback «Анализ из Clip»);
  - **«Обновить»** — повторный запрос к AI;
  - тело конспекта с минимальным markdown-парсером (`**жирное**` → bold).
- **Теги, дата создания, источник** — блоком ниже.
- **Удаление** — кнопка с подтверждением.

### ArchiveScreen (`app/(tabs)/archive.tsx`)

Список всех идей с поиском. Поиск (case-insensitive substring) учитывает: `text`, `title`, `tags`. Карточки рендерятся через `ClipCard`. Если у клипа есть `summary` — показывается мелкий бейдж «✦ Есть AI-анализ».

### Другие экраны

- **HomeScreen** (`app/(tabs)/index.tsx`) — daily-карточки + streak. Логика выбора карточек — см. `getDailyCards()` ниже.
- **SettingsScreen** (`app/(tabs)/settings.tsx`) — раздел AI-анализа (см. начало документа), напоминания, тема (`dark` / `light` / `system`).
- **OnboardingScreen** — первый запуск, ставит `onboardingDone = true`.

## Конфигурация (`app.json`)

```jsonc
{
  "expo": {
    "name": "Clip",
    "slug": "clip-app",
    "scheme": "clip-app",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "android": {
      "package": "com.jeeno93.clipapp",
      "softwareKeyboardLayoutMode": "pan",
      "permissions": ["android.permission.RECORD_AUDIO"]   // ← для голосового ввода
    },
    "plugins": [
      ["expo-router", { "origin": "https://replit.com/" }],
      "expo-font",
      "expo-web-browser",
      ["expo-notifications", { "icon": "...", "color": "#F5C842" }],
      ["expo-share-intent", {
        "iosActivationRules": { "NSExtensionActivationSupportsText": true, "NSExtensionActivationSupportsWebURLWithMaxCount": 1 },
        "androidIntentFilters": ["text/*", "image/*"]
      }]
    ]
  }
}
```

- **`android.permissions: ["android.permission.RECORD_AUDIO"]`** — необходимо для `@react-native-voice/voice`. На устройстве разрешение запрашивается рантайм через `PermissionsAndroid.request(...)`.
- **iOS** для голосового ввода требует ключи `NSMicrophoneUsageDescription` и `NSSpeechRecognitionUsageDescription` в `expo.ios.infoPlist` — пока не настроены.
- **`expo-share-intent`** — приём шарингов из других приложений (текст и изображения).
- **`expo-notifications`** — локальные напоминания (час задаётся в настройках).

## Технический стек

**Платформа:**
- Expo SDK 54 (`~54.0.27`), `newArchEnabled: true` (Fabric/TurboModules)
- React Native `0.81.5`, React 19
- expo-router `~6.0.17` (typed routes, file-based роутинг)

**Хранилище и состояние:**
- `@react-native-async-storage/async-storage` `2.2.0` — единственное локальное хранилище
- React Context (`ClipsContext`) — глобальный стейт идей и настроек

**UI и анимации:**
- `react-native-reanimated` `~4.1.1` + `react-native-worklets` `0.5.1` (пульсация микрофона, переходы)
- `react-native-gesture-handler` `~2.28.0`, `react-native-screens` `~4.16.0`, `react-native-safe-area-context` `~5.6.0`
- `@expo/vector-icons` `^15.0.3` (Feather)
- `@expo-google-fonts/inter` — Inter Regular/Medium/SemiBold/Bold
- `expo-image`, `expo-linear-gradient`, `expo-blur`, `expo-glass-effect`, `expo-haptics`, `expo-symbols`

**Системные интеграции:**
- `expo-notifications` `^0.32.16` — локальные напоминания
- `expo-share-intent` `^5.1.1` — приём шарингов (текст / картинки)
- `expo-image-picker` `~17.0.9` — выбор изображения из галереи
- `expo-web-browser`, `expo-linking`
- **`@react-native-voice/voice` `^3.2.4`** — голосовой ввод на экране добавления (требует dev build, в Expo Go недоступен)

**Утилиты:**
- `zod`, `zod-validation-error` — валидация
- `@tanstack/react-query` — кэш HTTP-запросов
- `@workspace/api-client-react` — типизированный клиент к `@workspace/api-server` (общий монорепо-пакет)

## Домены знаний

Карточки можно раскладывать по тематическим **доменам** (например, «🤖 AI и технологии», «📦 Продукт»). Карточка без домена считается лежащей во **Входящих** (`📥 Входящие`) — это «инбокс на разбор».

### Хранилище

- Ключ AsyncStorage: **`@clip:domains`** (массив `Domain[]`, отдельно от `@clip:settings`).
- Поле в клипе: **`Clip.domainId?: string`**. `undefined` или отсутствие поля = «Входящие».

### API в `src/storage/clips.ts`

| Функция | Назначение |
|---------|------------|
| `getAllDomains()` | Все домены, отсортированы по `createdAt` (старые сверху). |
| `saveDomain({ name, icon })` | Создаёт домен с авто-`id`/`createdAt`, возвращает его. |
| `updateDomain(id, changes)` | Частичное обновление домена. |
| `deleteDomain(id)` | Удаляет домен **и автоматически возвращает** все его клипы во Входящие (`domainId` стирается). |
| `moveClipToDomain(clipId, domainId \| null)` | Переносит клип в домен; `null` → во Входящие. |
| `getInboxClips()` | Клипы без `domainId`. |
| `getDomainClips(domainId)` | Клипы конкретного домена. |
| `getInboxCount()` | Количество клипов во Входящих. |

### `ClipsContext`

Контекст подгружает домены вместе с остальной базой и выставляет:

| Поле / метод | Описание |
|--------------|----------|
| `domains: Domain[]` | Все домены пользователя. |
| `inboxCount: number` | Производное от `clips` — `clips.filter(c => !c.domainId).length`. |
| `createDomain(data)` | Создание домена + локальный `refreshDomains`. |
| `removeDomain(id)` | Удаление домена + перезагрузка всего стейта (клипы получают `domainId = undefined`). |
| `moveClip(clipId, domainId \| null)` | Перенос клипа + перезагрузка стейта (счётчик Входящих и список фильтрации обновляются). |
| `refreshDomains()` | Точечное обновление списка доменов. |

### UI

- **Боковое меню** (`src/components/Sidebar.tsx`) — выезжает слева через `Modal` + `Animated.View` (translateX `-300 → 0`, 250ms). Ширина — 72% экрана, максимум 300. Полупрозрачный overlay (rgba 0,0,0,0.5) закрывает меню по тапу; меню также закрывается свайпом влево (`PanResponder`, порог 50px). Содержимое:
  - заголовок `✦ Clip` (янтарный);
  - `📥 Входящие` со счётчиком справа (рендерится только если `inboxCount > 0`);
  - `📚 Все идеи`;
  - подзаголовок `МОИ ДОМЕНЫ`;
  - список доменов (`icon + name`);
  - кнопка `+ Новый домен` (янтарная).
  - Активный пункт: фон `accentSubtle`, текст `accent`, левая полоса `accent` 3px.

- **Архив** (`app/(tabs)/archive.tsx`):
  - В шапке появилась кнопка-гамбургер ☰ слева — открывает Sidebar.
  - Стейт `activeDomainId: string | null | "all"` управляет фильтром:
    - `"all"` — все клипы (заголовок `Твоя база знаний`);
    - `null` — только Входящие (заголовок `📥 Входящие`);
    - `string` — конкретный домен (заголовок `<icon> <name>`).
  - Подзаголовок-счётчик показывает количество в текущем фильтре, а не во всём архиве.
  - Поддерживается deeplink-параметр `?domain=inbox|all|<id>` (использует `useFocusEffect` + `useLocalSearchParams`) — экран Home кидает сюда `?domain=inbox` по тапу на инбокс.
  - Снизу смонтированы `Sidebar` и `CreateDomainModal`. Создание нового домена из меню сразу делает его активным фильтром.

- **Создание домена** (`src/components/CreateDomainModal.tsx`) — bottom-sheet `Modal animationType="slide"`. Внутри:
  - заголовок «Новый домен» + ссылка «Отмена»;
  - горизонтальный скролл из 15 эмодзи: `🤖 📦 🧠 📚 💡 🎯 🔬 💼 🌍 🎨 ✍️ 🏗️ 📊 🎵 ❤️`. Активная подсвечивается янтарной обводкой и `accentSubtle` фоном;
  - `TextInput` с `maxLength={30}`, плейсхолдер «Название домена…», `autoFocus`;
  - янтарная кнопка «Создать» (disabled, если имя пустое); тап вызывает `createDomain({ name, icon })`.

- **Перемещение карточки** (`src/components/DomainPickerModal.tsx`) — bottom-sheet, открывается с детального экрана клипа из новой строки `ДОМЕН [📥 Входящие ▾]` в блоке метаданных. Внутри:
  - `📥 Входящие` (✓ если `clip.domainId` пустой);
  - все домены (✓ у текущего);
  - разделитель + `+ Создать домен` (открывает `CreateDomainModal`; после создания клип сразу переносится в новый домен).
  - Выбор вызывает `moveClip(clip.id, id)`, после чего весь стейт перегружается и UI обновляется без ручного `refresh`.

- **Главный экран** (`app/(tabs)/index.tsx`) — под streak'ом, если `inboxCount > 0`, отдельной строкой: `📥 N неразобранных` (textMuted, число — `accent`). Тап делает `router.push({ pathname: "/(tabs)/archive", params: { domain: "inbox" } })`.

**Инструменты:**
- TypeScript `~5.9.2`, `tsc --noEmit` для проверки типов
- `babel-plugin-react-compiler` (React Compiler включён через `experiments.reactCompiler`)
- pnpm workspaces (монорепо)
