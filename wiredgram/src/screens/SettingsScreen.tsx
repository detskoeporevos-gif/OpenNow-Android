import { useEffect, useState } from "react";
import type { JSX } from "react";
import { BottomNav } from "../components/BottomNav";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { clearBlobs } from "../lib/db";
import { formatBytes } from "../lib/format";
import {
  ACCENTS,
  refreshStorage,
  signOut,
  toast,
  updateSettings,
  useStore,
} from "../state/store";
import type { ThemeName } from "../types";

const THEMES: Array<{ id: ThemeName; label: string }> = [
  { id: "dark", label: "Тёмная" },
  { id: "amoled", label: "AMOLED" },
  { id: "light", label: "Светлая" },
];

function useBundleSize(): string {
  const [size, setSize] = useState<string>("—");
  useEffect(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    let bytes = 0;
    for (const entry of entries) {
      if (/\.(js|css)$/.test(entry.name)) {
        bytes += entry.encodedBodySize || entry.transferSize || 0;
      }
    }
    setSize(bytes ? formatBytes(bytes) : "—");
  }, []);
  return size;
}

function Toggle({
  title,
  sub,
  on,
  onChange,
}: {
  title: string;
  sub?: string;
  on: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <button
      className="row row--tap"
      onClick={() => onChange(!on)}
      style={{ textAlign: "left", width: "100%" }}
    >
      <div className="row__body">
        <span className="row__title">{title}</span>
        {sub && <span className="row__sub">{sub}</span>}
      </div>
      <span className="switch" data-on={on} />
    </button>
  );
}

export function SettingsScreen(): JSX.Element {
  const { settings, profile, storageBytes } = useStore();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const bundle = useBundleSize();

  const quota = 240 * 1024 * 1024; // conservative visual reference
  const usedPct = Math.min(100, Math.max(1.5, (storageBytes / quota) * 100));

  return (
    <div className="screen" data-anim="fade-in">
      <header className="topbar">
        <div className="topbar__title">
          <strong>Настройки</strong>
          <span>WiredGram 0.1.0 · демо</span>
        </div>
        <span className="brand__mark" style={{ width: 34, height: 34, borderRadius: 11 }}>
          <Icon name="bolt" size={17} />
        </span>
      </header>

      <div className="scroll">
        <div className="section-title">Оформление</div>
        <div className="group">
          <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <span className="label">Тема</span>
            <div className="segment">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  data-active={settings.theme === theme.id}
                  onClick={() => updateSettings({ theme: theme.id })}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <span className="label">Акцент</span>
            <div className="accent-row">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  className="accent-dot"
                  data-active={settings.accent === accent}
                  style={{ background: accent }}
                  aria-label={`Акцент ${accent}`}
                  onClick={() => updateSettings({ accent })}
                />
              ))}
            </div>
          </div>

          <Toggle
            title="Крупный текст"
            sub="Увеличивает базовый размер шрифта"
            on={settings.largeText}
            onChange={(largeText) => updateSettings({ largeText })}
          />
        </div>

        <div className="section-title">Производительность</div>
        <div className="group">
          <Toggle
            title="Lite-режим"
            sub="Отключает blur и тяжёлые эффекты — максимум FPS"
            on={settings.liteMode}
            onChange={(liteMode) => updateSettings({ liteMode })}
          />
          <Toggle
            title="Анимации"
            sub="Плавные переходы между экранами"
            on={settings.animations}
            onChange={(animations) => updateSettings({ animations })}
          />
          <Toggle
            title="Экономия трафика"
            sub="Видео-фон показывается статичным кадром"
            on={settings.dataSaver}
            onChange={(dataSaver) => updateSettings({ dataSaver })}
          />
          <Toggle
            title="Enter отправляет"
            sub="Иначе — только кнопка отправки"
            on={settings.sendOnEnter}
            onChange={(sendOnEnter) => updateSettings({ sendOnEnter })}
          />

          <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="row__title">Медиа на устройстве</span>
              <span className="row__sub">{formatBytes(storageBytes)}</span>
            </div>
            <div className="meter">
              <i style={{ width: `${usedPct}%` }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn--ghost"
                style={{ flex: 1, height: 40, fontSize: "0.8rem" }}
                onClick={() => {
                  void refreshStorage();
                  toast("Хранилище пересчитано", "info");
                }}
              >
                <Icon name="storage" size={16} /> Пересчитать
              </button>
              <button
                className="btn btn--danger"
                style={{ flex: 1, height: 40, fontSize: "0.8rem" }}
                onClick={async () => {
                  await clearBlobs();
                  await refreshStorage();
                  toast("Медиа-кэш очищен", "ok");
                }}
              >
                <Icon name="trash" size={16} /> Очистить
              </button>
            </div>
          </div>
        </div>

        <div className="section-title">Аккаунт</div>
        <div className="group">
          <div className="row">
            <Icon name="user" size={20} />
            <div className="row__body">
              <span className="row__title">{profile.name}</span>
              <span className="row__sub">@{profile.username} · {profile.phone}</span>
            </div>
          </div>
          <div className="row">
            <Icon name="shield" size={20} />
            <div className="row__body">
              <span className="row__title">Двухфакторная аутентификация</span>
              <span className="row__sub">Пароль подтверждён при входе</span>
            </div>
            <span className="badge" style={{ background: "color-mix(in srgb, var(--ok) 22%, transparent)", color: "var(--ok)" }}>
              ON
            </span>
          </div>
          <button className="btn btn--danger btn--block" onClick={() => setLogoutOpen(true)}>
            <Icon name="logout" size={18} /> Выйти из аккаунта
          </button>
        </div>

        <div className="section-title">О приложении</div>
        <div className="group">
          <div className="row">
            <Icon name="bolt" size={20} />
            <div className="row__body">
              <span className="row__title">Вес интерфейса</span>
              <span className="row__sub">{bundle} JS + CSS, без сторонних UI-библиотек</span>
            </div>
          </div>
          <div className="row">
            <Icon name="storage" size={20} />
            <div className="row__body">
              <span className="row__title">Локальное хранилище</span>
              <span className="row__sub">IndexedDB: состояние чатов и медиа</span>
            </div>
          </div>
          <div className="row">
            <Icon name="lock" size={20} />
            <div className="row__body">
              <span className="row__title">Приватность</span>
              <span className="row__sub">Демо-режим: сообщения не покидают устройство</span>
            </div>
          </div>
        </div>

        <div style={{ height: 110 }} />
      </div>

      <BottomNav />

      <Sheet open={logoutOpen} title="Выйти из WiredGram?" onClose={() => setLogoutOpen(false)}>
        <p className="hint" style={{ marginTop: 0 }}>
          Локальная сессия будет удалена. Чаты и медиа останутся на устройстве до очистки хранилища.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setLogoutOpen(false)}>
            Отмена
          </button>
          <button
            className="btn btn--danger"
            style={{ flex: 1 }}
            onClick={() => {
              setLogoutOpen(false);
              signOut();
            }}
          >
            Выйти
          </button>
        </div>
      </Sheet>
    </div>
  );
}
