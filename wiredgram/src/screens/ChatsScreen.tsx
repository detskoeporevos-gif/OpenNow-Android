import { useMemo } from "react";
import type { JSX } from "react";
import { Avatar } from "../components/Avatar";
import { BottomNav } from "../components/BottomNav";
import { Icon } from "../components/Icon";
import { listStamp } from "../lib/format";
import { go, setSearch, sortedChats, totalUnread, useStore } from "../state/store";
import type { Chat, Message } from "../types";

function previewText(chat: Chat, message: Message | undefined): JSX.Element {
  if (chat.typing) return <span className="dots">печатает…</span>;
  if (!message) return <span>Нет сообщений</span>;

  const prefix = message.from === "me" ? "Вы: " : "";
  const body = message.media
    ? message.media.kind === "video"
      ? "🎬 Видео"
      : message.media.kind === "gif"
        ? "🎞 GIF"
        : message.media.kind === "file"
          ? "📎 Файл"
          : "📷 Фото"
    : message.text;

  return (
    <span>
      {prefix && <b>{prefix}</b>}
      {message.media && message.text ? `${body} · ${message.text}` : body}
    </span>
  );
}

export function ChatsScreen(): JSX.Element {
  const { chats, search, profile } = useStore();
  const unread = totalUnread(chats);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? chats.filter(
          (c) =>
            c.title.toLowerCase().includes(query) ||
            c.handle?.toLowerCase().includes(query) ||
            c.messages.some((m) => m.text.toLowerCase().includes(query)),
        )
      : chats;
    return sortedChats(list);
  }, [chats, search]);

  return (
    <div className="screen" data-anim="fade-in">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">
            <Icon name="wired" size={20} strokeWidth={2.6} />
          </span>
          <div className="topbar__title">
            <strong>WiredGram</strong>
            <span>{unread > 0 ? `${unread} новых сообщений` : "всё прочитано"}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={() => go({ name: "profile" })} aria-label="Профиль">
          <Avatar name={profile.name} hue={profile.avatarHue} mediaId={profile.avatarMediaId} size={34} online={profile.online} />
        </button>
      </header>

      <div className="searchbar">
        <div className="input-wrap">
          <Icon name="search" size={18} />
          <input
            placeholder="Поиск по чатам и сообщениям"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск"
          />
          {search && (
            <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setSearch("")} aria-label="Очистить">
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="scroll">
        {visible.length === 0 && (
          <div className="empty">
            <Icon name="search" size={34} />
            <span>Ничего не найдено</span>
          </div>
        )}

        {visible.map((chat) => {
          const last = chat.messages[chat.messages.length - 1];
          return (
            <div
              key={chat.id}
              className={`chat-row${chat.unread > 0 ? " chat-row--unread" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => go({ name: "chat", chatId: chat.id })}
              onKeyDown={(e) => {
                if (e.key === "Enter") go({ name: "chat", chatId: chat.id });
              }}
            >
              <Avatar
                name={chat.title}
                hue={chat.avatarHue}
                mediaId={chat.avatarMediaId}
                size={54}
                online={chat.online}
                radius={18}
              />
              <div className="chat-row__body">
                <div className="chat-row__line">
                  <span className="chat-row__name">{chat.title}</span>
                  {chat.muted && <Icon name="bellOff" size={14} className="pin" />}
                  <span className="chat-row__time">{last ? listStamp(last.ts) : ""}</span>
                </div>
                <div className="chat-row__line">
                  <span className="chat-row__preview">{previewText(chat, last)}</span>
                  <div className="chat-row__meta">
                    {chat.pinned && <Icon name="pin" size={13} className="pin" />}
                    {chat.unread > 0 && <span className="badge">{chat.unread > 99 ? "99+" : chat.unread}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
