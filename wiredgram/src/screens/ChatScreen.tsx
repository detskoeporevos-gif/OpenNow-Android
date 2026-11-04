import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { Wallpaper } from "../components/Wallpaper";
import { clockTime, dayLabel, formatBytes, formatDuration, sameDay } from "../lib/format";
import { storeFile, useMediaUrl } from "../lib/media";
import {
  clearChat,
  go,
  react,
  sendMessage,
  toast,
  updateChat,
  useStore,
} from "../state/store";
import type { MediaRef, Message } from "../types";

const WINDOW = 60;
const REACTIONS = ["❤️", "👍", "🔥", "😂", "😮", "🙏"];

/* ── bubble media ───────────────────────────────────────────────── */

function BubbleMedia({ media }: { media: MediaRef }): JSX.Element | null {
  const url = useMediaUrl(media.blobId);

  if (!url) {
    return (
      <div className="bubble__file">
        <Icon name="image" size={22} />
        <div className="bubble__file-meta">
          <strong>{media.name}</strong>
          <span>загрузка…</span>
        </div>
      </div>
    );
  }

  if (media.kind === "video") {
    return (
      <span className="bubble__media">
        <video src={url} controls playsInline preload="metadata" />
      </span>
    );
  }

  if (media.kind === "file") {
    return (
      <a className="bubble__file" href={url} download={media.name}>
        <Icon name="storage" size={22} />
        <div className="bubble__file-meta">
          <strong>{media.name}</strong>
          <span>{formatBytes(media.size)}</span>
        </div>
      </a>
    );
  }

  return (
    <span className="bubble__media">
      <img src={url} alt={media.name} loading="lazy" decoding="async" />
    </span>
  );
}

/* ── bubble ─────────────────────────────────────────────────────── */

function Bubble({
  message,
  onOpenReactions,
}: {
  message: Message;
  onOpenReactions: (message: Message, x: number, y: number) => void;
}): JSX.Element {
  const holdRef = useRef<number | undefined>(undefined);
  const out = message.from === "me";

  const start = (e: React.PointerEvent<HTMLDivElement>): void => {
    const x = e.clientX;
    const y = e.clientY;
    holdRef.current = window.setTimeout(() => onOpenReactions(message, x, y), 420);
  };

  const cancel = (): void => {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = undefined;
  };

  return (
    <div
      className={`bubble ${out ? "bubble--out" : "bubble--in"}`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerMove={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {message.media && <BubbleMedia media={message.media} />}
      {message.text && <div className="bubble__text">{message.text}</div>}
      <div className="bubble__foot">
        {message.media?.kind === "video" && message.media.duration
          ? `${formatDuration(message.media.duration)} · `
          : ""}
        {clockTime(message.ts)}
        {out && (
          <span className={`tick${message.status !== "sending" ? " tick--read" : ""}`}>
            <Icon name={message.status === "sending" ? "check" : "checks"} size={14} strokeWidth={2.2} />
          </span>
        )}
      </div>
      {message.reaction && <span className="reaction">{message.reaction}</span>}
    </div>
  );
}

/* ── screen ─────────────────────────────────────────────────────── */

export function ChatScreen({ chatId }: { chatId: string }): JSX.Element {
  const { chats, wallpaper, settings } = useStore();
  const chat = chats.find((c) => c.id === chatId);

  const [text, setText] = useState("");
  const [pending, setPending] = useState<MediaRef | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowSize, setWindowSize] = useState(WINDOW);
  const [nearBottom, setNearBottom] = useState(true);
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<{ messageId: string; x: number; y: number } | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const rafRef = useRef(0);
  const pendingUrl = useMediaUrl(pending?.blobId);

  const messages = chat?.messages ?? [];
  const visible = useMemo(() => messages.slice(-windowSize), [messages, windowSize]);

  useEffect(() => {
    if (!chat) go({ name: "chats" });
  }, [chat]);

  /* keep the view pinned to the newest message */
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length, chat?.typing, nearBottom]);

  /* grow the composer with the message, up to 120px */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = listRef.current;
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setNearBottom(distance < 140);
    });
  }, []);

  const scrollToBottom = (): void => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: settings.animations ? "smooth" : "auto" });
    setNearBottom(true);
  };

  const pickFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) {
      toast("Файл больше 64 МБ", "error");
      return;
    }
    setSending(true);
    try {
      const media = await storeFile(file);
      setPending(media);
    } catch {
      toast("Не удалось прочитать файл", "error");
    } finally {
      setSending(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (!chat) return;
    const value = text;
    if (!value.trim() && !pending) return;
    setText("");
    const media = pending ?? undefined;
    setPending(null);
    sendMessage(chat.id, value, media);
    setNearBottom(true);
    inputRef.current?.focus();
  };

  const openReactions = (message: Message, x: number, y: number): void => {
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return;
    setReactions({
      messageId: message.id,
      x: Math.min(Math.max(x - rect.left - 124, 8), Math.max(8, rect.width - 262)),
      y: Math.min(Math.max(y - rect.top - 56, 60), rect.height - 160),
    });
  };

  if (!chat) return <div className="screen" />;

  const canLoadMore = messages.length > windowSize;
  let lastDay = 0;

  return (
    <div className="screen chat" data-anim="slide-in" ref={screenRef}>
      <Wallpaper wallpaper={wallpaper} dataSaver={settings.dataSaver} />

      <header className="chat__bar">
        <button className="icon-btn" onClick={() => go({ name: "chats" })} aria-label="Назад">
          <Icon name="back" size={22} />
        </button>
        <Avatar name={chat.title} hue={chat.avatarHue} mediaId={chat.avatarMediaId} size={38} online={chat.online} />
        <div className="chat__who">
          <strong>{chat.title}</strong>
          <span data-online={!!chat.online && !chat.typing}>
            {chat.typing ? "печатает…" : chat.online ? "онлайн" : chat.presence ?? "был(а) недавно"}
          </span>
        </div>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Ещё">
          <Icon name="more" size={20} />
        </button>
      </header>

      <div className="messages" ref={listRef} onScroll={onScroll}>
        {canLoadMore && (
          <button
            className="day"
            style={{ cursor: "pointer" }}
            onClick={() => setWindowSize((size) => size + WINDOW)}
          >
            Показать раньше
          </button>
        )}

        {visible.map((message) => {
          const showDay = !sameDay(lastDay, message.ts);
          if (showDay) lastDay = message.ts;
          return (
            <div key={message.id} style={{ display: "contents" }}>
              {showDay && <div className="day">{dayLabel(message.ts)}</div>}
              <Bubble message={message} onOpenReactions={openReactions} />
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="empty">
            <Icon name="chat" size={34} />
            <span>История пуста — напишите первым</span>
          </div>
        )}

        {chat.typing && (
          <div className="typing" aria-label="печатает">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>

      {!nearBottom && (
        <button className="scroll-fab" onClick={scrollToBottom} aria-label="Вниз">
          <Icon name="down" size={18} />
        </button>
      )}

      <div className="composer">
        <button className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Прикрепить">
          <Icon name="attach" size={22} />
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,video/*,.gif,.pdf,.zip,.txt"
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="composer__field">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Сообщение"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && settings.sendOnEnter) {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </div>
        <button
          className="send"
          onClick={() => void submit()}
          disabled={sending || (!text.trim() && !pending)}
          aria-label="Отправить"
        >
          <Icon name="send" size={20} strokeWidth={2} />
        </button>
      </div>

      {pending && (
        <div className="attach-preview" style={{ position: "absolute", left: 0, right: 0, bottom: "calc(76px + var(--safe-bottom))" }}>
          {pending.kind === "video" ? (
            <video src={pendingUrl} muted />
          ) : pending.kind === "image" || pending.kind === "gif" ? (
            <img src={pendingUrl} alt="" />
          ) : (
            <div className="avatar" style={{ width: 46, height: 46, borderRadius: 10 }}>
              <Icon name="storage" size={20} />
            </div>
          )}
          <div className="bubble__file-meta" style={{ flex: 1 }}>
            <strong style={{ fontSize: "0.85rem" }}>{pending.name}</strong>
            <span style={{ fontSize: "0.72rem", color: "var(--ink-dim)" }}>{formatBytes(pending.size)}</span>
          </div>
          <button className="icon-btn" onClick={() => setPending(null)} aria-label="Убрать вложение">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      {reactions && (
        <>
          <div
            style={{ position: "absolute", inset: 0, zIndex: 19 }}
            onPointerDown={() => setReactions(null)}
          />
          <div className="reactions-bar" style={{ left: reactions.x, top: reactions.y }}>
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  react(chat.id, reactions.messageId, emoji);
                  setReactions(null);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet open={menuOpen} title={chat.title} onClose={() => setMenuOpen(false)}>
        <div className="list" style={{ padding: 0 }}>
          <button
            className="row row--tap"
            onClick={() => {
              updateChat(chat.id, { pinned: !chat.pinned });
              setMenuOpen(false);
            }}
          >
            <Icon name="pin" size={20} />
            <div className="row__body">
              <span className="row__title">{chat.pinned ? "Открепить чат" : "Закрепить чат"}</span>
              <span className="row__sub">Чат будет выше в списке</span>
            </div>
          </button>

          <button
            className="row row--tap"
            onClick={() => {
              updateChat(chat.id, { muted: !chat.muted });
              setMenuOpen(false);
            }}
          >
            <Icon name="bellOff" size={20} />
            <div className="row__body">
              <span className="row__title">{chat.muted ? "Включить уведомления" : "Без звука"}</span>
              <span className="row__sub">Уведомления этого чата</span>
            </div>
          </button>

          <button
            className="row row--tap"
            onClick={() => {
              clearChat(chat.id);
              setMenuOpen(false);
              toast("История очищена", "ok");
            }}
          >
            <Icon name="trash" size={20} />
            <div className="row__body">
              <span className="row__title" style={{ color: "var(--danger)" }}>
                Очистить историю
              </span>
              <span className="row__sub">Сообщения удалятся только на этом устройстве</span>
            </div>
          </button>
        </div>
      </Sheet>
    </div>
  );
}
