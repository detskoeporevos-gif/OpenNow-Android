/** Shared data model for WiredGram. Kept deliberately flat so the whole app
 *  state serialises to a single IndexedDB record. */

export type RouteName = "auth" | "chats" | "chat" | "profile" | "settings";

export type Route =
  | { name: "auth" }
  | { name: "chats" }
  | { name: "chat"; chatId: string }
  | { name: "profile" }
  | { name: "settings" };

export type MediaKind = "image" | "gif" | "video" | "file";

export interface MediaRef {
  blobId: string;
  kind: MediaKind;
  name: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
}

export type MessageStatus = "sending" | "sent" | "read";

export interface Message {
  id: string;
  chatId: string;
  from: "me" | "them";
  text: string;
  ts: number;
  status: MessageStatus;
  media?: MediaRef;
  reaction?: string;
  pendingUpload?: number;
}

export interface Chat {
  id: string;
  title: string;
  handle?: string;
  avatarHue: number;
  avatarMediaId?: string;
  online?: boolean;
  presence?: string;
  pinned?: boolean;
  muted?: boolean;
  unread: number;
  typing?: boolean;
  /** Demo bots answer automatically. */
  autoReply?: string[];
  messages: Message[];
}

export interface Profile {
  id: string;
  name: string;
  username: string;
  bio: string;
  phone: string;
  avatarMediaId?: string;
  avatarHue: number;
  online: boolean;
}

export type WallpaperKind = "none" | "gradient" | "image" | "gif" | "video";

export interface Wallpaper {
  kind: WallpaperKind;
  gradient: string;
  mediaId?: string;
  /** 0..1 — how strongly the wallpaper shows through the chat. */
  opacity: number;
  /** 0..40 px */
  blur: number;
  /** 0..1 dark scrim on top of the media, keeps bubbles readable. */
  dim: number;
  fit: "cover" | "contain";
  animated: boolean;
}

export type ThemeName = "dark" | "amoled" | "light";

export interface Settings {
  theme: ThemeName;
  accent: string;
  /** Disables blur/backdrop filters and long animations. */
  liteMode: boolean;
  animations: boolean;
  dataSaver: boolean;
  largeText: boolean;
  sendOnEnter: boolean;
}

export interface AuthSession {
  userId: string;
  name: string;
  phone: string;
  createdAt: number;
}

export interface Toast {
  id: string;
  text: string;
  tone: "ok" | "error" | "info";
}
