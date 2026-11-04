/**
 * WiredGram state — a 150-line reactive store on top of useSyncExternalStore.
 *
 * Why not Redux/Zustand? Because this ships to a phone: no dependency, no
 * middleware, no devtools payload. Every mutation produces one new frozen
 * snapshot, React re-renders only the screens that read it, and the snapshot is
 * persisted to IndexedDB (debounced) so a cold start is instant.
 */

import { useSyncExternalStore } from "react";
import { blobKeysSize, kvGet, kvSet } from "../lib/db";
import { newId } from "../lib/media";
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
  state = {
    ...state,
    session: null,
    route: { name: "auth" },
    chats: [],
    profile: DEFAULT_PROFILE,
    search: "",
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

export function updateProfile(patch: Partial<Profile>): void {
  set({ profile: { ...state.profile, ...patch } });
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

/* ── chats ───────────────────────────────────────────────────────── */

function patchChat(chatId: string, patch: Partial<Chat> | ((chat: Chat) => Chat)): void {
  set({
    chats: state.chats.map((chat) =>
      chat.id === chatId ? (typeof patch === "function" ? patch(chat) : { ...chat, ...patch }) : chat,
    ),
  });
}

export function markRead(chatId: string): void {
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
