import { useEffect } from "react";
import type { CSSProperties, JSX } from "react";
import { Toasts } from "./components/Toasts";
import { Icon } from "./components/Icon";
import { AuthScreen } from "./screens/AuthScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { ChatsScreen } from "./screens/ChatsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { boot, useStore } from "./state/store";

function Splash(): JSX.Element {
  return (
    <div className="splash">
      <div className="splash__mark">
        <Icon name="wired" size={52} strokeWidth={2.6} />
      </div>
      <strong>WiredGram</strong>
      <span>подключаемся…</span>
    </div>
  );
}

export function App(): JSX.Element {
  const { ready, route, session, settings } = useStore();

  useEffect(() => {
    void boot();
  }, []);

  /* Large-text preference scales every rem-based size at once. */
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = settings.largeText ? "17.5px" : "16px";
  }, [settings.largeText]);

  const style = {
    "--accent": settings.accent,
    "--text-scale": settings.largeText ? "1.08" : "1",
  } as CSSProperties;

  const authed = !!session;

  return (
    <div
      className="shell"
      style={style}
      data-theme={settings.theme}
      data-lite={settings.liteMode}
      data-animations={settings.animations ? "on" : "off"}
    >
      {!ready ? (
        <Splash />
      ) : !authed || route.name === "auth" ? (
        <AuthScreen />
      ) : route.name === "chat" ? (
        <ChatScreen key={route.chatId} chatId={route.chatId} />
      ) : route.name === "profile" ? (
        <ProfileScreen />
      ) : route.name === "settings" ? (
        <SettingsScreen />
      ) : (
        <ChatsScreen />
      )}

      <Toasts />
    </div>
  );
}
