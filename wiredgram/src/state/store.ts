/**
 * WiredGram state — a 150-line reactive store on top of useSyncExternalStore.
 *
 * Why not Redux/Zustand? Because this ships to a phone: no dependency, no
 * middleware, no devtools payload. Every mutation produces one new frozen
 * snapshot, React re-renders only the screens that read it, and the snapshot is
 * persisted to IndexedDB (debounced) so a cold start is instant.
 */

import { useSyncExternalStore } from "react";
import { blobKeysSize, getBlob, kvGet, kvSet } from "../lib/db";
import { newId } from "../lib/media";
import * as tg from "./telegram";
import type { TgMe, TgStage } from "./telegram";
import type {
  AuthSession,
  Chat,
  MediaRef,
  Message,
  Profile,
  Route,
  Settings,
  Toast,
  Wallpaper,
} from "../types";
import { seedChats } from "./seed";

export const ACCENTS = ["#4dd4ff", "#a06bff", "#5ef0b0", "#ffb648", "#ff6b9a", "#7ee0ff"];

export const DEFAULT_WALLPAPER: Wallpaper = {
  kind: "gradient",
  gradient: "linear-gradient(160deg, #10131f 0%, #0a0d14 55%, #06070b 100%)",
  opacity: 0.85,
  blur: 0,
  dim: 0.35,
  fit: "cover",
  animated: true,
};

export const DEFAULT_SETTINGS: Settings = {
  connection: "demo",
  tgApiId: tg.DEFAULT_TG_API.apiId,
  tgApiHash: tg.DEFAULT_TG_API.apiHash,
  theme: "dark",
  accent: ACCENTS[0],
  liteMode: false,
  animations: true,
  dataSaver: false,
  largeText: false,
  sendOnEnter: true,
};

const DEFAULT_PROFILE: Profile = {
  id: "me",
  name: "Вы",
  username: "wired_user",
  bio: "На связи через WiredGram ⚡",
  phone: "",
  avatarHue: 196,
  online: true,
};

export interface State {
  ready: boolean;
  session: AuthSession | null;
  route: Route;
  profile: Profile;
  chats: Chat[];
  wallpaper: Wallpaper;
  settings: Settings;
  toasts: Toast[];
  search: string;
  storageBytes: number;
  /** Telegram connection state (only used when settings.connection === "telegram"). */
  tgStage: TgStage;
  tgMe?: TgMe;
  tgError?: string;
}

interface Persisted {
  session: AuthSession | null;
  profile: Profile;
  chats: Chat[];
  wallpaper: Wallpaper;
  settings: Settings;
}

const STORAGE_KEY = "state-v1";

let state: State = {
  ready: false,
  session: null,
  route: { name: "auth" },
  profile: DEFAULT_PROFILE,
  chats: [],
  wallpaper: DEFAULT_WALLPAPER,
  settings: DEFAULT_SETTINGS,
  toasts: [],
  search: "",
  storageBytes: 0,
  tgStage: "off",
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function set(next: Partial<State>): void {
  state = { ...state, ...next };
  emit();
  schedulePersist();
}

let persistTimer: number | undefined;

function schedulePersist(): void {
  if (!state.session) return;
  if (persistTimer !== undefined) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    void persist();
  }, 350);
}

async function persist(): Promise<void> {
  const snapshot: Persisted = {
    session: state.session,
    profile: state.profile,
    chats: state.chats,
    wallpaper: state.wallpaper,
    settings: state.settings,
  };
  await kvSet(STORAGE_KEY, snapshot);
}

/* ── selectors ───────────────────────────────────────────────────── */

export function useStore(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function getState(): State {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ── boot ────────────────────────────────────────────────────────── */

let booted = false;

export async function boot(): Promise<void> {
  if (booted) return;
  booted = true;

  const saved = await kvGet<Persisted>(STORAGE_KEY);
  const storageBytes = await blobKeysSize();

  if (saved?.session) {
    const chats = saved.chats?.length ? saved.chats : await seedChats();
    state = {
      ...state,
      ready: true,
      session: saved.session,
      route: { name: "chats" },
      profile: { ...DEFAULT_PROFILE, ...saved.profile, phone: saved.profile?.phone || saved.session.phone },
      chats,
      wallpaper: { ...DEFAULT_WALLPAPER, ...saved.wallpaper },
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      storageBytes,
    };
    emit();
    if (state.settings.connection === "telegram") void reconnectTelegram();
    return;
  }

  state = { ...state, ready: true, storageBytes };
  emit();
}

/* ── auth ────────────────────────────────────────────────────────── */

export async function signIn(session: AuthSession): Promise<void> {
  const chats = await seedChats();
  const profile: Profile = {
    ...DEFAULT_PROFILE,
    id: session.userId,
    name: session.name,
    username: session.name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 20) || "wired_user",
    phone: session.phone,
  };
  set({ session, profile, chats, route: { name: "chats" } });
  await persist();
}

export function signOut(): void {
  if (state.settings.connection === "telegram") void tg.tgLogout();
  historyFetched.clear();
  state = {
    ...state,
    session: null,
    route: { name: "auth" },
    chats: [],
    profile: DEFAULT_PROFILE,
    search: "",
    tgStage: "off",
    tgMe: undefined,
    tgError: undefined,
  };
  emit();
  void kvSet(STORAGE_KEY, null);
}

/* ── navigation ──────────────────────────────────────────────────── */

export function go(route: Route): void {
  if (route.name === "chat") {
    markRead(route.chatId);
  }
  set({ route });
}

export function setSearch(search: string): void {
  set({ search });
}

/* ── toasts ──────────────────────────────────────────────────────── */

export function toast(text: string, tone: Toast["tone"] = "info"): void {
  const item: Toast = { id: newId("t"), text, tone };
  set({ toasts: [...state.toasts.slice(-2), item] });
  window.setTimeout(() => {
    set({ toasts: state.toasts.filter((t) => t.id !== item.id) });
  }, 2600);
}

/* ── profile & appearance ────────────────────────────────────────── */

let tgProfileTimer: number | undefined;

export function updateProfile(patch: Partial<Profile>): void {
  set({ profile: { ...state.profile, ...patch } });
  if (state.settings.connection !== "telegram" || !tg.isAuthorized()) return;
  if (patch.name === undefined && patch.bio === undefined) return;
  // debounce: typing a name should send one request, not one per key
  if (tgProfileTimer !== undefined) window.clearTimeout(tgProfileTimer);
  tgProfileTimer = window.setTimeout(() => {
    const { name, bio } = state.profile;
    void tg.tgUpdateProfile(name, bio);
  }, 900);
}

export function updateSettings(patch: Partial<Settings>): void {
  set({ settings: { ...state.settings, ...patch } });
}

export function updateWallpaper(patch: Partial<Wallpaper>): void {
  set({ wallpaper: { ...state.wallpaper, ...patch } });
}

export async function refreshStorage(): Promise<void> {
  const storageBytes = await blobKeysSize();
  set({ storageBytes });
}

/* ── telegram (real MTProto account) ─────────────────────────────── */

const historyFetched = new Set<string>();

const TG: tg.TgCallbacks = {
  onChats: (chats) => mergeChats(chats),
  onMessage: (chatId, message, incoming) => {
    const open = state.route.name === "chat" && state.route.chatId === chatId;
    patchChat(chatId, (c) => ({
      ...c,
      typing: false,
      unread: incoming && !open ? c.unread + 1 : c.unread,
      messages: mergeMessages(c.messages, [message]),
    }));
    if (open && incoming) void tg.tgMarkRead(chatId);
  },
  onAvatar: (chatId, mediaId) => patchChat(chatId, { avatarMediaId: mediaId }),
};

tg.setTgCallbacks(TG);

/** Union two message lists by id, keeping already-downloaded media blobs. */
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return existing;
  const map = new Map<string, Message>();
  for (const message of existing) map.set(message.id, message);
  for (const message of incoming) {
    const previous = map.get(message.id);
    if (!previous) {
      map.set(message.id, message);
      continue;
    }
    const media =
      previous.media && message.media
        ? { ...message.media, blobId: previous.media.blobId || message.media.blobId }
        : (previous.media ?? message.media);
    map.set(message.id, { ...previous, ...message, media, reaction: previous.reaction ?? message.reaction });
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

function mergeChats(incoming: Chat[]): void {
  if (incoming.length === 0) return;
  const byId = new Map(state.chats.map((chat) => [chat.id, chat]));
  const merged = incoming.map((chat) => {
    const existing = byId.get(chat.id);
    if (!existing) return chat;
    return {
      ...chat,
      avatarMediaId: existing.avatarMediaId ?? chat.avatarMediaId,
      muted: existing.muted,
      typing: existing.typing,
      messages: mergeMessages(existing.messages, chat.messages),
      unread:
        state.route.name === "chat" && state.route.chatId === chat.id ? 0 : Math.max(chat.unread, 0),
    };
  });
  set({ chats: merged });
}

function applyMe(me: TgMe | undefined): void {
  if (!me) return;
  set({
    tgMe: me,
    profile: {
      ...state.profile,
      id: `tg_${me.id}`,
      name: me.name || state.profile.name,
      username: me.username || state.profile.username,
      phone: me.phone || state.profile.phone,
    },
  });
}

export async function reconnectTelegram(): Promise<void> {
  const { tgApiId, tgApiHash } = state.settings;
  set({ tgStage: "connecting", tgError: undefined });
  try {
    const me = await tg.tgRestore({ apiId: tgApiId, apiHash: tgApiHash }, TG);
    if (!me) {
      set({ tgStage: "off" });
      return;
    }
    applyMe(me);
    const chats = await tg.tgFetchChats();
    mergeChats(chats);
    set({ tgStage: "ready" });
    void tg.tgMyAvatar().then((mediaId) => {
      if (mediaId) updateProfile({ avatarMediaId: mediaId });
    });
  } catch (error) {
    set({ tgStage: "error", tgError: tg.describeError(error) });
  }
}

export async function startTelegramLogin(
  phone: string,
): Promise<{ ok: boolean; error?: string; viaApp?: boolean }> {
  const { tgApiId, tgApiHash } = state.settings;
  set({ tgStage: "connecting", tgError: undefined });
  const result = await tg.tgSendCode({ apiId: tgApiId, apiHash: tgApiHash }, phone);
  if (!result.ok) {
    set({ tgStage: "error", tgError: result.error });
    return { ok: false, error: result.error };
  }
  set({ tgStage: "code" });
  return { ok: true, viaApp: result.viaApp };
}

export async function submitTelegramCode(
  code: string,
): Promise<{ ok: boolean; needsPassword?: boolean; hint?: string; error?: string }> {
  set({ tgStage: "connecting", tgError: undefined });
  const result = await tg.tgSignIn(code);
  if (!result.ok) {
    set({ tgStage: "code", tgError: result.error });
    return { ok: false, error: result.error };
  }
  if (result.needsPassword) {
    set({ tgStage: "password", tgError: undefined });
    return { ok: true, needsPassword: true, hint: result.hint };
  }
  await finishTelegramLogin();
  return { ok: true };
}

export async function submitTelegramPassword(
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  set({ tgStage: "connecting", tgError: undefined });
  const result = await tg.tgCheckPassword(password);
  if (!result.ok) {
    set({ tgStage: "password", tgError: result.error });
    return { ok: false, error: result.error };
  }
  await finishTelegramLogin();
  return { ok: true };
}

async function finishTelegramLogin(): Promise<void> {
  const me = await tg.tgMe();
  const session: AuthSession = {
    userId: `tg_${me?.id ?? "me"}`,
    name: me?.name ?? "Telegram",
    phone: me?.phone ?? "",
    createdAt: Date.now(),
  };
  applyMe(me);
  historyFetched.clear();
  set({
    session,
    route: { name: "chats" },
    chats: [],
    tgStage: "ready",
    tgError: undefined,
    search: "",
    profile: {
      ...state.profile,
      id: session.userId,
      name: me?.name ?? state.profile.name,
      username: me?.username ?? state.profile.username,
      phone: session.phone,
    },
  });
  const chats = await tg.tgFetchChats();
  mergeChats(chats);
  await persist();
  void tg.tgMyAvatar().then((mediaId) => {
    if (mediaId) updateProfile({ avatarMediaId: mediaId });
  });
}

/** Load the message history of a Telegram chat once per session. */
export async function syncHistory(chatId: string): Promise<void> {
  if (state.settings.connection !== "telegram" || !tg.isTgChat(chatId)) return;
  if (historyFetched.has(chatId)) return;
  historyFetched.add(chatId);
  try {
    const messages = await tg.tgFetchHistory(chatId, 60);
    if (messages.length === 0) return;
    patchChat(chatId, (chat) => ({ ...chat, messages: mergeMessages(chat.messages, messages) }));
    void tg.tgMarkRead(chatId);
  } catch (error) {
    historyFetched.delete(chatId);
    toast(tg.describeError(error), "error");
  }
}

/** Download a Telegram attachment into IndexedDB and attach it to the message. */
export async function downloadMedia(chatId: string, messageId: string): Promise<void> {
  const chat = state.chats.find((c) => c.id === chatId);
  const message = chat?.messages.find((m) => m.id === messageId);
  if (!message?.media?.remote) return;
  const blobId = await tg.tgDownloadMedia(message.media);
  if (!blobId) {
    toast("Не удалось скачать файл", "error");
    return;
  }
  patchChat(chatId, (c) => ({
    ...c,
    messages: c.messages.map((m) =>
      m.id === messageId && m.media ? { ...m, media: { ...m.media, blobId } } : m,
    ),
  }));
}

/** Upload a Telegram avatar. Returns true when the server accepted it. */
export async function uploadTelegramAvatar(file: File): Promise<boolean> {
  if (state.settings.connection !== "telegram") return false;
  return tg.tgUploadAvatar(file);
}

async function sendTelegramMessage(chatId: string, text: string, media?: MediaRef): Promise<void> {
  const trimmed = text.trim();
  const temp: Message = {
    id: newId("msg"),
    chatId,
    from: "me",
    text: trimmed,
    ts: Date.now(),
    status: "sending",
    media,
  };
  patchChat(chatId, (chat) => ({ ...chat, messages: [...chat.messages, temp] }));

  try {
    let sent: Message | undefined;
    if (media) {
      const blob = await getBlob(media.blobId);
      if (blob) {
        const file = new File([blob], media.name || "file", {
          type: media.mime || blob.type || "application/octet-stream",
        });
        sent = await tg.tgSendFile(chatId, file, trimmed);
      }
    }
    if (!sent && trimmed) sent = await tg.tgSendText(chatId, trimmed);

    patchChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === temp.id ? (sent ? { ...sent, media: sent.media ?? message.media } : { ...message, status: "sent" }) : message,
      ),
    }));
  } catch (error) {
    patchChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.filter((message) => message.id !== temp.id),
    }));
    toast(tg.describeError(error), "error");
  }
}

/** Switch between the offline demo and a real Telegram account. */
export async function setConnection(connection: "demo" | "telegram"): Promise<void> {
  if (state.settings.connection === connection) return;
  updateSettings({ connection });
  if (connection === "telegram") {
    set({ session: null, chats: [], route: { name: "auth" }, tgStage: "off" });
  } else {
    signOut();
  }
}

/* ── chats ───────────────────────────────────────────────────────── */

function patchChat(chatId: string, patch: Partial<Chat> | ((chat: Chat) => Chat)): void {
  set({
    chats: state.chats.map((chat) =>
      chat.id === chatId ? (typeof patch === "function" ? patch(chat) : { ...chat, ...patch }) : chat,
    ),
  });
}

export function markRead(chatId: string): void {
  if (state.settings.connection === "telegram" && tg.isTgChat(chatId)) void tg.tgMarkRead(chatId);
  const chat = state.chats.find((c) => c.id === chatId);
  if (!chat || chat.unread === 0) {
    if (chat?.unread === 0) return;
  }
  patchChat(chatId, (c) => ({
    ...c,
    unread: 0,
    messages: c.messages.map((m) => (m.from === "them" && m.status !== "read" ? { ...m, status: "read" } : m)),
  }));
}

export function react(chatId: string, messageId: string, emoji: string): void {
  patchChat(chatId, (c) => ({
    ...c,
    messages: c.messages.map((m) =>
      m.id === messageId ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m,
    ),
  }));
}

const replyTimers = new Map<string, number[]>();

function clearTimers(chatId: string): void {
  const timers = replyTimers.get(chatId);
  if (timers) timers.forEach((t) => window.clearTimeout(t));
  replyTimers.delete(chatId);
}

export function sendMessage(chatId: string, text: string, media?: MediaRef): void {
  const trimmed = text.trim();
  if (!trimmed && !media) return;

  if (state.settings.connection === "telegram" && tg.isTgChat(chatId)) {
    if (!trimmed && !media) return;
    void sendTelegramMessage(chatId, trimmed, media);
    return;
  }

  const message: Message = {
    id: newId("msg"),
    chatId,
    from: "me",
    text: trimmed,
    ts: Date.now(),
    status: "sending",
    media,
  };

  patchChat(chatId, (c) => ({ ...c, messages: [...c.messages, message] }));
  void refreshStorage();

  const timers: number[] = [];
  timers.push(
    window.setTimeout(() => {
      patchChat(chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === message.id ? { ...m, status: "sent" } : m)),
      }));
    }, 320),
  );

  timers.push(
    window.setTimeout(() => {
      patchChat(chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === message.id ? { ...m, status: "read" } : m)),
      }));
    }, 1400),
  );

  const chat = state.chats.find((c) => c.id === chatId);
  if (chat?.autoReply?.length) {
    timers.push(
      window.setTimeout(() => {
        patchChat(chatId, { typing: true });
      }, 700),
    );
    timers.push(
      window.setTimeout(() => {
        const pool = chat.autoReply ?? [];
        const reply = pool[Math.floor(Math.random() * pool.length)] ?? "👍";
        const incoming: Message = {
          id: newId("msg"),
          chatId,
          from: "them",
          text: reply,
          ts: Date.now(),
          status: "sent",
        };
        const isOpen = state.route.name === "chat" && state.route.chatId === chatId;
        patchChat(chatId, (c) => ({
          ...c,
          typing: false,
          unread: isOpen ? 0 : c.unread + 1,
          messages: [...c.messages, incoming],
        }));
      }, 1800 + Math.random() * 1200),
    );
  }

  replyTimers.set(chatId, timers);
}

/** Patch chat flags from the UI (pin / mute / ...). */
export function updateChat(chatId: string, patch: Partial<Chat>): void {
  patchChat(chatId, patch);
}

export function clearChat(chatId: string): void {
  clearTimers(chatId);
  patchChat(chatId, { messages: [], unread: 0, typing: false });
}

export function sortedChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const aTs = a.messages[a.messages.length - 1]?.ts ?? 0;
    const bTs = b.messages[b.messages.length - 1]?.ts ?? 0;
    return bTs - aTs;
  });
}

export function lastMessage(chat: Chat): Message | undefined {
  return chat.messages[chat.messages.length - 1];
}

export function totalUnread(chats: Chat[]): number {
  return chats.reduce((sum, c) => sum + c.unread, 0);
}
