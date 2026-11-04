import type { JSX } from "react";
import { Icon, type IconName } from "./Icon";
import { go, totalUnread, useStore } from "../state/store";

const ITEMS: Array<{ route: "chats" | "profile" | "settings"; label: string; icon: IconName }> = [
  { route: "chats", label: "Чаты", icon: "chat" },
  { route: "profile", label: "Профиль", icon: "user" },
  { route: "settings", label: "Настройки", icon: "settings" },
];

export function BottomNav(): JSX.Element {
  const { route, chats } = useStore();
  const unread = totalUnread(chats);

  return (
    <nav className="nav" aria-label="Основная навигация">
      {ITEMS.map((item) => {
        const active = route.name === item.route;
        return (
          <button
            key={item.route}
            className="nav__item"
            data-active={active}
            onClick={() => go({ name: item.route })}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
            {item.route === "chats" && unread > 0 && <span className="nav__dot" />}
          </button>
        );
      })}
    </nav>
  );
}
