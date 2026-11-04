/**
 * Real Telegram client (MTProto) on top of teleproto — a maintained GramJS fork.
 *
 * Everything is loaded lazily: demo mode never downloads the ~480 KB gzip of
 * MTProto code, it is fetched only when the user actually signs in to Telegram.
 *
 * This module owns:
 *   1. the TelegramClient singleton + session persistence (IndexedDB `kv`)
 *   2. phone → code → 2FA login (manual flow, so a typo never re-sends a code)
 *   3. mapping TL objects to WiredGram's flat Chat/Message model
 *   4. dialogs, history, sending, media download, live updates
 */

import { kvGet, kvSet } from "../lib/db";
import { storeBlob } from "../lib/media";
import type { Chat, MediaRef, Message } from "../types";

/* ── public types ────────────────────────────────────────────────── */

export type TgStage = "off" | "connecting" | "code" | "password" | "ready" | "error";

export interface TgMe {
  id: string;
  name: string;
  username: string;
  phone: string;
}

export interface TgApiConfig {
  apiId: number;
  apiHash: string;
}

export interface TgCallbacks {
  onChats: (chats: Chat[]) => void;
  onMessage: (chatId: string, message: Message, incoming: boolean) => void;
  onAvatar: (chatId: string, mediaId: string) => void;
}

export interface TgResult {
  ok: boolean;
  error?: string;
}

/* ── internals ───────────────────────────────────────────────────── */

const SESSION_KEY = "tg-session-v1";

/** Telegram Web K credentials. Replace with your own from my.telegram.org. */
export const DEFAULT_TG_API: TgApiConfig = {
  apiId: 2040,
  apiHash: "b18441a1ff607e10a989891a5462e627",
};

type TgEntity = {
  id: unknown;
  className?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  username?: string;
  phone?: string;
  photo?: unknown;
  status?: { className?: string };
};

type TgRawMessage = {
  id: number;
  message?: string;
  date?: number;
  out?: boolean;
  unread?: boolean;
  photo?: unknown;
  video?: unknown;
  videoNote?: unknown;
  document?: unknown;
  audio?: unknown;
  voice?: unknown;
  sticker?: unknown;
  action?: unknown;
  media?: unknown;
  peerId?: { className?: string; userId?: unknown; chatId?: unknown; channelId?: unknown };
};

type TgDialog = {
  entity?: TgEntity;
  title?: string;
  unreadCount?: number;
  message?: TgRawMessage;
  pinned?: boolean;
};

interface TgClient {
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  invoke(request: unknown): Promise<unknown>;
  session: { save(): string };
  isUserAuthorized(): Promise<boolean>;
  getMe(): Promise<TgEntity>;
  sendCode(
    credentials: TgApiConfig,
    phone: string,
    forceSMS?: boolean,
  ): Promise<{ phoneCodeHash: string; isCodeViaApp?: boolean }>;
  signInWithPassword(credentials: TgApiConfig, params: { password: string }): Promise<TgEntity>;
  getDialogs(params: { limit?: number }): Promise<TgDialog[]>;
  getMessages(entity: TgEntity, params: { limit?: number; ids?: number | number | number[] }): Promise<TgRawMessage[]>;
  sendMessage(entity: TgEntity, params: { message: string }): Promise<TgRawMessage>;
  sendFile(entity: TgEntity, params: Record<string, unknown>): Promise<TgRawMessage>;
  markAsRead(entity: TgEntity): Promise<unknown>;
  downloadMedia(message: TgRawMessage): Promise<unknown>;
  downloadProfilePhoto(entity: TgEntity, params: { isBig?: boolean }): Promise<unknown>;
  addEventHandler(handler: (event: unknown) => void, builder: unknown): void;
  uploadProfilePhoto(params: { file: File }): Promise<unknown>;
  logOut(): Promise<unknown>;
}

/** Cached lazy module namespace (teleproto is CJS, so we keep it around). */
let tg: { Api: any; TelegramClient: any } | null = null;
let client: TgClient | null = null;
let api: TgApiConfig = DEFAULT_TG_API;
let callbacks: TgCallbacks | null = null;
let authorized = false;
let pendingCodeHash = "";
let pendingPhone = "";
let lastStage: TgStage = "off";

const entities = new Map<string, TgEntity>();
const avatarTried = new Set<string>();

export function setTgCallbacks(cb: TgCallbacks | null): void {
  callbacks = cb;
}

export function tgStage(): TgStage {
  return lastStage;
}

async function loadTelegram(): Promise<{ Api: any; TelegramClient: any }> {
  if (tg) return tg;
  tg = (await import("teleproto")) as unknown as { Api: any; TelegramClient: any };
  return tg;
}

/** Uint8Array/ArrayBuffer → Blob without the SharedArrayBuffer typing dance. */
function toBlob(data: unknown, type: string): Blob {
  const bytes = data as Uint8Array | ArrayBuffer;
  const buffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  return new Blob([buffer as ArrayBuffer], { type });
}

function hashOf(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function chatIdFor(entity: TgEntity): string {
  const kind = entity.className === "Channel" ? "ch" : entity.className === "Chat" ? "c" : "u";
  return `tg_${kind}_${String(entity.id)}`;
}

export function isTgChat(chatId: string): boolean {
  return chatId.startsWith("tg_");
}

function titleOf(entity: TgEntity, fallback = "Telegram"): string {
  if (entity.className === "User") {
    const name = [entity.firstName, entity.lastName].filter(Boolean).join(" ").trim();
    return name || (entity.username ? `@${entity.username}` : fallback);
  }
  return entity.title || entity.username || fallback;
}

/* ── client lifecycle ────────────────────────────────────────────── */

async function getClient(config: TgApiConfig): Promise<TgClient> {
  if (client) return client;

  api = config;
  const [{ TelegramClient }, sessions, events] = await Promise.all([
    loadTelegram(),
    import("teleproto/sessions"),
    import("teleproto/events"),
  ]);

  const saved = (await kvGet<string>(SESSION_KEY)) || "";
  const instance = new TelegramClient(new sessions.StringSession(saved), config.apiId, config.apiHash, {
    connectionRetries: 3,
    requestRetries: 3,
    autoReconnect: true,
    retryDelay: 1200,
    deviceModel: "WiredGram",
    systemVersion: "web",
    appVersion: "1.0.0",
    langCode: "ru",
  }) as TgClient;

  instance.addEventHandler(handleUpdate, new events.NewMessage({}));
  client = instance;
  return client;
}

export async function saveSession(): Promise<void> {
  if (!client) return;
  try {
    await kvSet(SESSION_KEY, client.session.save());
  } catch {
    /* best effort */
  }
}

export async function tgHasSession(): Promise<boolean> {
  const saved = await kvGet<string>(SESSION_KEY);
  return typeof saved === "string" && saved.length > 16;
}

/** Reconnect with a stored session. Returns the signed-in user or undefined. */
export async function tgRestore(config: TgApiConfig, cb: TgCallbacks): Promise<TgMe | undefined> {
  callbacks = cb;
  try {
    const c = await getClient(config);
    if (!c.connected) await c.connect();
    if (!(await c.isUserAuthorized())) {
      authorized = false;
      lastStage = "off";
      return undefined;
    }
    authorized = true;
    lastStage = "ready";
    void saveSession();
    return readMe(c);
  } catch (error) {
    lastStage = "error";
    throw error;
  }
}

async function readMe(c: TgClient): Promise<TgMe> {
  const me = await c.getMe();
  return {
    id: String(me.id),
    name: titleOf(me, "Telegram"),
    username: me.username || "",
    phone: me.phone ? `+${me.phone}` : "",
  };
}

export function isAuthorized(): boolean {
  return authorized && !!client;
}

/* ── login ───────────────────────────────────────────────────────── */

export async function tgSendCode(config: TgApiConfig, phone: string): Promise<TgResult & { viaApp?: boolean }> {
  lastStage = "connecting";
  try {
    const c = await getClient(config);
    if (!c.connected) await c.connect();
    const sent = await c.sendCode({ apiId: config.apiId, apiHash: config.apiHash }, phone);
    pendingCodeHash = sent.phoneCodeHash;
    pendingPhone = phone;
    lastStage = "code";
    return { ok: true, viaApp: !!sent.isCodeViaApp };
  } catch (error) {
    lastStage = "error";
    return { ok: false, error: describeError(error) };
  }
}

export async function tgSignIn(code: string): Promise<TgResult & { needsPassword?: boolean; hint?: string }> {
  try {
    const { Api } = await loadTelegram();
    const c = await getClient(api);
    await c.invoke(
      new Api.auth.SignIn({
        phoneNumber: pendingPhone,
        phoneCodeHash: pendingCodeHash,
        phoneCode: code.trim(),
      }),
    );
    authorized = true;
    lastStage = "ready";
    void saveSession();
    return { ok: true };
  } catch (error) {
    const text = errorText(error);
    if (/SESSION_PASSWORD_NEEDED/.test(text)) {
      lastStage = "password";
      return { ok: true, needsPassword: true, hint: await passwordHint() };
    }
    lastStage = "code";
    return { ok: false, error: describeError(error) };
  }
}

export async function tgCheckPassword(password: string): Promise<TgResult> {
  try {
    const c = await getClient(api);
    await c.signInWithPassword({ apiId: api.apiId, apiHash: api.apiHash }, { password });
    authorized = true;
    lastStage = "ready";
    void saveSession();
    return { ok: true };
  } catch (error) {
    lastStage = "password";
    return { ok: false, error: describeError(error) };
  }
}

async function passwordHint(): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const { Api } = await loadTelegram();
    const password = (await client.invoke(new Api.account.GetPassword())) as { hint?: string };
    return password.hint || undefined;
  } catch {
    return undefined;
  }
}

export async function tgMe(): Promise<TgMe | undefined> {
  if (!client || !authorized) return undefined;
  try {
    return await readMe(client);
  } catch {
    return undefined;
  }
}

export async function tgLogout(): Promise<void> {
  try {
    if (client) {
      await client.logOut().catch(() => undefined);
      await client.disconnect().catch(() => undefined);
    }
  } finally {
    client = null;
    authorized = false;
    entities.clear();
    avatarTried.clear();
    lastStage = "off";
    await kvSet(SESSION_KEY, "");
  }
}

/* ── mapping ─────────────────────────────────────────────────────── */

function documentOf(raw: TgRawMessage): { mimeType?: string; size?: number; attributes?: Array<Record<string, unknown>> } | null {
  const doc = (raw.document ?? raw.video ?? raw.audio ?? raw.voice ?? raw.videoNote ?? null) as
    | { mimeType?: string; size?: number; attributes?: Array<Record<string, unknown>> }
    | null;
  return doc;
}

function mediaKindOf(raw: TgRawMessage): MediaRef["kind"] | undefined {
  const doc = documentOf(raw);
  const mime = doc?.mimeType ?? "";

  if (raw.photo || raw.sticker) return "image";
  if (raw.video || raw.videoNote) return "video";
  if (raw.voice || raw.audio) return "file";
  if (mime.startsWith("image/")) return mime === "image/gif" ? "gif" : "image";
  if (mime.startsWith("video/")) return "video";
  if (raw.document) return "file";
  return undefined;
}

function fileNameOf(doc: ReturnType<typeof documentOf>): string {
  for (const attr of doc?.attributes ?? []) {
    if (typeof attr.fileName === "string" && attr.fileName) return attr.fileName;
  }
  return "файл";
}

function mediaRefOf(raw: TgRawMessage, chatId: string): MediaRef | undefined {
  const kind = mediaKindOf(raw);
  if (!kind) return undefined;

  const doc = documentOf(raw);
  const photo = raw.photo as { sizes?: Array<{ size?: number }> } | undefined;
  const size = doc?.size ?? photo?.sizes?.[photo.sizes.length - 1]?.size ?? 0;
  const mime = doc?.mimeType ?? (kind === "video" ? "video/mp4" : "image/jpeg");

  return {
    blobId: "",
    kind,
    name: kind === "file" ? fileNameOf(doc) : kind === "video" ? "видео" : "фото",
    size,
    mime,
    remote: { chatId, messageId: raw.id },
  };
}

function toMessage(chatId: string, raw: TgRawMessage): Message {
  return {
    id: `tg_${chatId}_${raw.id}`,
    chatId,
    from: raw.out ? "me" : "them",
    text: raw.message ?? "",
    ts: (raw.date ?? Math.floor(Date.now() / 1000)) * 1000,
    status: raw.out ? "read" : "sent",
    media: mediaRefOf(raw, chatId),
  };
}

function presenceOf(entity: TgEntity): { online: boolean; presence: string } {
  switch (entity.status?.className) {
    case "UserStatusOnline":
      return { online: true, presence: "онлайн" };
    case "UserStatusRecently":
      return { online: false, presence: "был(а) недавно" };
    case "UserStatusLastWeek":
      return { online: false, presence: "был(а) на этой неделе" };
    case "UserStatusLastMonth":
      return { online: false, presence: "был(а) в этом месяце" };
    case "UserStatusOffline":
      return { online: false, presence: "не в сети" };
    default:
      return { online: false, presence: entity.className === "User" ? "не в сети" : "канал" };
  }
}

function toChat(dialog: TgDialog): Chat | undefined {
  const entity = dialog.entity;
  if (!entity) return undefined;

  const id = chatIdFor(entity);
  entities.set(id, entity);
  const presence = presenceOf(entity);
  const last = dialog.message;

  return {
    id,
    title: dialog.title || titleOf(entity),
    handle: entity.username ? `@${entity.username}` : undefined,
    avatarHue: hashOf(id) % 360,
    online: presence.online,
    presence: presence.presence,
    pinned: !!dialog.pinned,
    unread: dialog.unreadCount ?? 0,
    messages: last ? [toMessage(id, last)] : [],
  };
}

/* ── data ────────────────────────────────────────────────────────── */

export async function tgFetchChats(): Promise<Chat[]> {
  if (!client || !authorized) return [];
  const dialogs = await client.getDialogs({ limit: 60 });
  const chats: Chat[] = [];
  for (const dialog of dialogs) {
    const chat = toChat(dialog);
    if (chat) chats.push(chat);
  }
  chats.sort((a, b) => (b.messages[0]?.ts ?? 0) - (a.messages[0]?.ts ?? 0));
  void loadAvatars(chats.slice(0, 24));
  return chats;
}

export async function tgFetchHistory(chatId: string, limit = 60): Promise<Message[]> {
  const entity = entities.get(chatId);
  if (!client || !entity) return [];
  const raw = await client.getMessages(entity, { limit });
  return raw
    .filter((message) => !message.action || !!message.message || !!message.media)
    .map((message) => toMessage(chatId, message))
    .reverse();
}

export async function tgSendText(chatId: string, text: string): Promise<Message | undefined> {
  const entity = entities.get(chatId);
  if (!client || !entity) return undefined;
  const raw = await client.sendMessage(entity, { message: text });
  return toMessage(chatId, raw);
}

export async function tgSendFile(chatId: string, file: File, caption: string): Promise<Message | undefined> {
  const entity = entities.get(chatId);
  if (!client || !entity) return undefined;
  const raw = await client.sendFile(entity, {
    file,
    caption: caption || undefined,
    forceDocument: false,
  });
  return toMessage(chatId, raw);
}

export async function tgMarkRead(chatId: string): Promise<void> {
  const entity = entities.get(chatId);
  if (!client || !entity) return;
  await client.markAsRead(entity).catch(() => undefined);
}

/** Download one message attachment into IndexedDB and return its blob id. */
export async function tgDownloadMedia(media: MediaRef): Promise<string | undefined> {
  if (!media.remote || !client) return undefined;
  const entity = entities.get(media.remote.chatId);
  if (!entity) return undefined;

  try {
    const raw = await client.getMessages(entity, { ids: media.remote.messageId });
    const message = raw[0];
    if (!message) return undefined;
    const data = (await client.downloadMedia(message)) as Uint8Array | undefined;
    if (!data || data.length === 0) return undefined;
    const stored = await storeBlob(toBlob(data, media.mime || "application/octet-stream"), media.name || "media");
    return stored.blobId;
  } catch {
    return undefined;
  }
}

async function loadAvatars(chats: Chat[]): Promise<void> {
  const instance = client;
  if (!instance || !callbacks) return;
  let index = 0;
  const worker = async (): Promise<void> => {
    while (index < chats.length) {
      const chat = chats[index++];
      if (!callbacks || avatarTried.has(chat.id)) continue;
      avatarTried.add(chat.id);
      const entity = entities.get(chat.id);
      if (!entity?.photo) continue;
      try {
        const data = (await instance.downloadProfilePhoto(entity, { isBig: false })) as Uint8Array | undefined;
        if (!data || data.length === 0) continue;
        const stored = await storeBlob(toBlob(data, "image/jpeg"), `avatar_${chat.id}.jpg`);
        callbacks.onAvatar(chat.id, stored.blobId);
      } catch {
        /* decoration only */
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

export async function tgMyAvatar(): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const me = await client.getMe();
    const data = (await client.downloadProfilePhoto(me, { isBig: true })) as Uint8Array | undefined;
    if (!data || data.length === 0) return undefined;
    const stored = await storeBlob(toBlob(data, "image/jpeg"), "me.jpg");
    return stored.blobId;
  } catch {
    return undefined;
  }
}

/** Upload a new profile picture to Telegram. */
export async function tgUploadAvatar(file: File): Promise<boolean> {
  if (!client || !authorized) return false;
  try {
    await client.uploadProfilePhoto({ file });
    return true;
  } catch {
    return false;
  }
}

/** Push a new first/last name and bio to the real account. */
export async function tgUpdateProfile(name: string, bio: string): Promise<void> {
  if (!client || !authorized) return;
  try {
    const { Api } = await loadTelegram();
    const [first, ...rest] = name.trim().split(/\s+/);
    await client.invoke(
      new Api.account.UpdateProfile({
        firstName: first || undefined,
        lastName: rest.join(" ") || undefined,
        about: bio.slice(0, 70) || undefined,
      }),
    );
  } catch {
    /* profile edits are not critical */
  }
}

/* ── updates ─────────────────────────────────────────────────────── */

function peerKeyOf(message: TgRawMessage): string | undefined {
  const peer = message.peerId;
  if (!peer) return undefined;
  if (peer.className === "PeerUser") return `tg_u_${String(peer.userId)}`;
  if (peer.className === "PeerChat") return `tg_c_${String(peer.chatId)}`;
  if (peer.className === "PeerChannel") return `tg_ch_${String(peer.channelId)}`;
  return undefined;
}

function handleUpdate(event: unknown): void {
  const message = (event as { message?: TgRawMessage }).message;
  if (!message) return;
  const chatId = peerKeyOf(message);
  if (!chatId) return;
  callbacks?.onMessage(chatId, toMessage(chatId, message), !message.out);
}

/* ── errors ──────────────────────────────────────────────────────── */

function errorText(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as { errorMessage?: string; message?: string };
    return `${err.errorMessage ?? ""} ${err.message ?? ""}`;
  }
  return String(error);
}

export function describeError(error: unknown): string {
  const text = errorText(error);
  if (/SESSION_PASSWORD_NEEDED/.test(text)) return "Нужен пароль двухфакторной аутентификации.";
  if (/PHONE_CODE_INVALID|PHONE_CODE_EMPTY/.test(text)) return "Неверный код — попробуйте ещё раз.";
  if (/PHONE_CODE_EXPIRED/.test(text)) return "Код истёк. Запросите новый.";
  if (/PASSWORD_HASH_INVALID/.test(text)) return "Неверный пароль 2FA.";
  if (/PHONE_NUMBER_INVALID/.test(text)) return "Неверный номер телефона.";
  if (/PHONE_NUMBER_BANNED/.test(text)) return "Этот номер заблокирован в Telegram.";
  if (/PHONE_NUMBER_UNOCCUPIED/.test(text)) return "На этот номер нет аккаунта Telegram — сначала зарегистрируйтесь в официальном клиенте.";
  if (/FLOOD_WAIT_(\d+)/.test(text)) {
    const seconds = Number(/FLOOD_WAIT_(\d+)/.exec(text)?.[1] ?? 0);
    return `Слишком много попыток. Подождите ${seconds > 0 ? `${seconds} с` : "немного"}.`;
  }
  if (/API_ID_INVALID|API_ID_PUBLISHED_FLOOD/.test(text)) {
    return "Telegram отклонил api_id. Укажите свои api_id/api_hash из my.telegram.org в настройках.";
  }
  if (/TIMEOUT|NETWORK|CONNECTION|WebSocket|socket/i.test(text)) {
    return "Нет связи с Telegram. Проверьте интернет и попробуйте снова.";
  }
  if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED/.test(text)) return "Сессия недействительна — войдите заново.";
  const clean = text.replace(/^[A-Z_]+ ?/, "").trim();
  return clean.slice(0, 140) || "Неизвестная ошибка Telegram.";
}
