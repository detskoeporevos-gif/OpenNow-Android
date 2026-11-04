# WiredGram

**Настоящий клиент Telegram** (MTProto, через `teleproto`) в мобильном интерфейсе,
который собирается в установочный **APK** через Capacitor.

```
wiredgram/                     ← Vite + React 19 + TypeScript клиент
wiredgram/android/             ← Capacitor-проект, из него собирается APK
.github/workflows/android-apk.yml  ← CI: npm ci → vite build → cap sync → gradlew assembleDebug → APK
backup/                        ← zip-архив предыдущего проекта OpenNOW (локально, вне git)
```

## APK

Готовый APK приходит артефактом **`wiredgram-apk`** из workflow `android-apk`
(Actions → android-apk → последний запуск → Artifacts). APK debug-подписан, ставится на любой
Android 7.0+ (minSdk 24) как обычное приложение `app.wiredgram.client` («WiredGram»).

Локально, если есть JDK 21 и Android SDK:

```bash
cd wiredgram
npm install
npm run apk        # build → cap sync → gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Запуск в браузере

```bash
cd wiredgram
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit + production-сборка
npm run preview    # собранный бандл
```

## Вход

На экране авторизации есть переключатель **Демо / Telegram**:

- **Telegram** — настоящий вход: номер → код из Telegram/SMS → облачный пароль 2FA.
  Дальше подтягиваются ваши диалоги, история, медиа и live-обновления (`NewMessage`).
  Сессия MTProto хранится в IndexedDB; `api_id`/`api_hash` можно заменить в настройках
  (по умолчанию — публичные ключи Telegram Web K: `2040`).
- **Демо** — офлайн-данные для показа интерфейса без сети.

Демо-вход

| Шаг | Значение |
|-----|----------|
| Телефон | любой номер, минимум 8 цифр |
| Код из SMS | `12345` |
| Пароль 2FA | `wiredgram` |

Есть кнопка «Войти как гость» — попасть внутрь без формы.

## Что внутри

**Telegram (MTProto)**
- Настоящий `TelegramClient` из `teleproto`, подгружается лениво отдельным чанком —
  демо-режим не платит за 420 КБ MTProto-кода.
- Вход: `auth.sendCode` → `auth.signIn` → SRP-пароль (`signInWithPassword`), без пересылки кода при опечатке.
- Диалоги (`messages.getDialogs`), история (`getMessages`), отправка текста и файлов, отметки о прочтении.
- Медиа скачивается по требованию (`downloadMedia` → Blob в IndexedDB), аватары — в фоне с лимитом 3 параллельных.
- Живые обновления через `NewMessage`; профиль обновляется через `account.updateProfile` (с дебаунсом).

**Авторизация**
- Ввод номера с выбором кода страны и автоформатированием.
- OTP-код: 5 ячеек, автопереход, вставка из буфера, повторная отправка с таймером.
- Второй фактор: пароль, показ/скрытие, понятные ошибки.
- Транспорт вынесен в `src/state/auth.ts` (демо) и `src/state/telegram.ts` (реальный MTProto).

**Чаты**
- 10 демо-диалогов с русским контентом, непрочитанными, закрепами, «без звука».
- Поиск по названиям и тексту сообщений.
- Экран чата: разделители по дням, статусы ✓/✓✓, индикатор «печатает…», автоответы.
- Вложения: фото, GIF, видео (с проигрыванием), файлы — через IndexedDB, лимит 64 МБ.
- Долгое нажатие на сообщение → панель реакций.
- Меню чата: закрепить, отключить уведомления, очистить историю.
- Кнопка «вниз», автопрокрутка, окно рендера по 60 сообщений.

**Профиль**
- Загрузка аватара, имя, username, био, статистика.
- Фон профиля и чатов: градиент, фото, GIF или **видео** (`autoplay muted loop playsinline`).
- Прозрачность, размытие, затемнение, режим заполнения, анимация.
- 6 готовых градиентов + предпросмотр с «живыми» бабблами.

**Настройки**
- Темы: тёмная, AMOLED, светлая. 6 акцентов.
- Крупный текст, анимации, экономия трафика, отправка по Enter.
- Lite-режим: отключает `backdrop-filter` и эффекты.
- Хранилище: подсчёт занятого места и очистка медиа-кэша.
- Выход из аккаунта.

## Почему это быстро

- Основной бандл **~93 КБ gzip JS + 6.5 КБ CSS**; MTProto-клиент — отдельные ленивые чанки.
- Иконки — инлайновые SVG-пути (`src/components/Icon.tsx`), без иконочных шрифтов и lucide.
- Один CSS-файл на CSS-переменных: темы переключаются атрибутом `data-theme`, а не JS.
- Состояние — один `useSyncExternalStore`-стор, запись в IndexedDB с дебаунсом 350 мс.
- Медиа — `Blob` в IndexedDB + LRU-кэш объектных URL (64 записи), изображения `loading="lazy"`.
- Демо-фото рисуются на canvas и хранятся локально — в бандле нет ни одной картинки.
- Список чатов использует `content-visibility: auto`; экран чата рендерит окно из 60 сообщений.
- Демо-режим полностью офлайн; в Telegram-режиме сеть нужна только для MTProto.

## Структура

```
wiredgram/
├─ index.html
├─ public/                manifest, иконка
└─ src/
   ├─ App.tsx             роутинг, темы, splash
   ├─ styles.css          дизайн-система (~1700 строк, один файл)
   ├─ types.ts            доменные типы
   ├─ state/
   │  ├─ auth.ts          транспорт демо-авторизации
   │  ├─ telegram.ts      реальный MTProto-клиент: вход, диалоги, медиа, апдейты
   │  ├─ store.ts         состояние + действия + персист + мост в Telegram
   │  └─ seed.ts          демо-данные
   ├─ lib/
   │  ├─ db.ts            IndexedDB: kv + blobs
   │  ├─ media.ts         файлы, объектные URL, canvas-фото
   │  └─ format.ts        русские даты, байты, длительности
   ├─ components/         Avatar, Icon, Wallpaper, Sheet, Slider, Toasts, BottomNav
   └─ screens/            Auth (телефон → OTP → 2FA), Chats, Chat, Profile, Settings
```

## Бэкап предыдущего проекта

Исходный OpenNOW (Electron + Capacitor + Android CI) сохранён в
`backup/opennow-android-2026-11-04.zip` — 184 файла, 2.8 МБ, включая `.github/workflows`,
README и ассеты. Архив не попадает в git (см. `.gitignore`), но остаётся в рабочей папке;
история git тоже содержит все прежние файлы.
