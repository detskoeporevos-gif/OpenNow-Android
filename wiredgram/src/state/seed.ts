/**
 * Demo dataset. Generated locally the first time you sign in — no network, no
 * bundled photos (the sample images are drawn on a canvas and stored in
 * IndexedDB, which keeps the app download tiny).
 */

import { makeGradientPhoto, newId } from "../lib/media";
import type { Chat, Message } from "../types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

interface SeedMessage {
  from: "me" | "them";
  text: string;
  ago: number;
  media?: boolean;
  reaction?: string;
}

interface Seed {
  title: string;
  handle?: string;
  hue: number;
  online?: boolean;
  presence?: string;
  pinned?: boolean;
  muted?: boolean;
  unread?: number;
  photo?: string;
  replies: string[];
  messages: SeedMessage[];
}

function msg(chatId: string, seed: SeedMessage, now: number, mediaId?: string): Message {
  return {
    id: newId("msg"),
    chatId,
    from: seed.from,
    text: seed.text,
    ts: now - seed.ago,
    status: seed.from === "me" ? "read" : "read",
    reaction: seed.reaction,
    media: mediaId
      ? { blobId: mediaId, kind: "image", name: "photo.jpg", size: 184_000, mime: "image/jpeg", width: 900, height: 1200 }
      : seed.media
        ? { blobId: `missing_${chatId}`, kind: "image", name: "image.jpg", size: 92_000, mime: "image/jpeg" }
        : undefined,
  };
}

const SEEDS: Seed[] = [
  {
    title: "WiredGram Team",
    handle: "@wiredgram",
    hue: 196,
    online: true,
    presence: "онлайн",
    pinned: true,
    unread: 2,
    photo: "Wired",
    replies: ["Принято ⚡", "Уже смотрим", "Спасибо, обновили!", "Кинь скриншот?"],
    messages: [
      { from: "them", text: "Привет! Добро пожаловать в WiredGram 👋", ago: 3 * HOUR },
      { from: "them", text: "Это демо-клиент: авторизация, 2FA, чаты, вложения и фон профиля работают локально.", ago: 2.9 * HOUR },
      { from: "me", text: "Выглядит очень быстро 😳", ago: 2.6 * HOUR },
      { from: "them", text: "Так и задумано. Попробуй поставить видео на фон в профиле!", ago: 2.5 * HOUR, reaction: "🔥" },
      { from: "them", text: "И не забудь про слайдер прозрачности — он реально меняет читаемость.", ago: 40 * MIN },
      { from: "them", text: "Кстати, вот фото из вчерашнего теста:", ago: 12 * MIN },
    ],
  },
  {
    title: "Лена 💫",
    hue: 320,
    online: true,
    presence: "онлайн",
    unread: 1,
    photo: "Lena",
    replies: ["ага :)", "скинь ещё", "я в метро, наберу позже", "😅"],
    messages: [
      { from: "them", text: "Ты уже видел новый фон? 😍", ago: 5 * HOUR },
      { from: "me", text: "Да, поставил себе море в блюре", ago: 4.8 * HOUR },
      { from: "them", text: "Скинь скрин", ago: 4.7 * HOUR },
      { from: "them", text: "И где встречаемся вечером?", ago: 8 * MIN },
    ],
  },
  {
    title: "Макс Петров",
    hue: 262,
    presence: "был(а) 12 минут назад",
    replies: ["ок", "завтра в 10?", "понял, спасибо", "сделаю"],
    messages: [
      { from: "me", text: "Привет! Макет готов?", ago: 26 * HOUR },
      { from: "them", text: "Почти. Остались тени на карточках", ago: 25 * HOUR },
      { from: "them", text: "Скинул в папку, глянь", ago: 24 * HOUR },
      { from: "me", text: "Кайф, принято 👍", ago: 23 * HOUR },
    ],
  },
  {
    title: "Мама",
    hue: 22,
    presence: "был(а) час назад",
    replies: ["Хорошо, солнышко", "Позвони, как сможешь", "Не забудь поесть!", "Обнимаю ❤️"],
    messages: [
      { from: "them", text: "Ты поел?", ago: 3 * HOUR },
      { from: "me", text: "Да, мам 🙂", ago: 2.9 * HOUR },
      { from: "them", text: "Молодец. Как погода у вас?", ago: 2.8 * HOUR },
      { from: "them", text: "Отправила тебе фото с дачи", ago: 2.7 * HOUR },
    ],
  },
  {
    title: "Dev Ops",
    hue: 168,
    presence: "3 участника",
    replies: ["деплой зелёный", "логи посмотрел, чисто", "перезапустил под", "готово ✅"],
    messages: [
      { from: "them", text: "Сборка APK прошла за 2м40с ⚡", ago: 20 * HOUR },
      { from: "them", text: "Кэш gradle включён, дальше будет быстрее", ago: 19 * HOUR },
      { from: "me", text: "Отлично, оставляем", ago: 18 * HOUR },
    ],
  },
  {
    title: "Кофейный клуб",
    hue: 34,
    presence: "12 участников",
    muted: true,
    unread: 5,
    replies: ["+1", "я за", "в субботу?", "не смогу, увы"],
    messages: [
      { from: "them", text: "Кто в субботу на дегустацию?", ago: 6 * HOUR },
      { from: "them", text: "Новая обжарка из Эфиопии, обещают ягодность", ago: 5.8 * HOUR },
      { from: "me", text: "Я в деле", ago: 5.7 * HOUR, reaction: "☕" },
      { from: "them", text: "Записал! Встречаемся в 11:00", ago: 5.5 * HOUR },
    ],
  },
  {
    title: "Kai",
    hue: 300,
    online: true,
    presence: "онлайн",
    photo: "Kai",
    replies: ["nice", "let's ship it", "one sec", "on it 🚀"],
    messages: [
      { from: "them", text: "Bro, the touch UI is slick", ago: 30 * HOUR },
      { from: "me", text: "Thanks! Trying to keep it under 100kb", ago: 29 * HOUR },
      { from: "them", text: "Unreal. Send me the build when it's green", ago: 28 * HOUR },
    ],
  },
  {
    title: "Учебная группа",
    hue: 208,
    presence: "24 участника",
    replies: ["скинула конспект", "во сколько пара?", "спасибо!", "у меня тоже вопрос"],
    messages: [
      { from: "them", text: "Напоминаю: завтра коллоквиум в 9:30", ago: 2 * DAY },
      { from: "them", text: "Вот конспект по последней теме", ago: 1.9 * DAY },
      { from: "me", text: "Спасибо огромное 🙏", ago: 1.8 * DAY },
    ],
  },
  {
    title: "Podcast Squad",
    hue: 268,
    presence: "5 участников",
    replies: ["записал дорожку", "слушаю", "крутой тейк", "надо переписать концовку"],
    messages: [
      { from: "them", text: "Выпуск 12 смонтирован, 38 минут", ago: 2.4 * DAY },
      { from: "me", text: "Обложку сделаю к вечеру", ago: 2.3 * DAY },
    ],
  },
  {
    title: "Арт-дроп",
    hue: 350,
    presence: "канал",
    muted: true,
    replies: ["добавил в избранное", "красиво!", "нужен ещё один вариант"],
    messages: [
      { from: "them", text: "Сегодняшний дроп: неоновые градиенты 🎨", ago: 3.2 * DAY },
      { from: "them", text: "Кто хочет в коллаборацию — пишите", ago: 3.1 * DAY },
    ],
  },
];

export async function seedChats(): Promise<Chat[]> {
  const now = Date.now();
  const chats: Chat[] = [];

  for (const seed of SEEDS) {
    const id = `chat_${seed.title.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_")}`;

    // Generate at most one real photo per chat, and only when the demo is empty.
    let photoId: string | undefined;
    if (seed.photo) {
      try {
        const media = await makeGradientPhoto(seed.hue, seed.photo);
        photoId = media.blobId;
      } catch {
        photoId = undefined;
      }
    }

    const messages = seed.messages.map((m, index) =>
      msg(id, m, now, index === seed.messages.length - 1 ? photoId : undefined),
    );

    chats.push({
      id,
      title: seed.title,
      handle: seed.handle,
      avatarHue: seed.hue,
      avatarMediaId: photoId,
      online: seed.online,
      presence: seed.presence,
      pinned: seed.pinned,
      muted: seed.muted,
      unread: seed.unread ?? 0,
      autoReply: seed.replies,
      messages,
    });
  }

  return chats;
}
