import { useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Avatar } from "../components/Avatar";
import { BottomNav } from "../components/BottomNav";
import { Icon } from "../components/Icon";
import { Slider } from "../components/Slider";
import { Wallpaper } from "../components/Wallpaper";
import { storeFile } from "../lib/media";
import {
  DEFAULT_WALLPAPER,
  go,
  refreshStorage,
  toast,
  updateProfile,
  updateWallpaper,
  useStore,
} from "../state/store";
import type { WallpaperKind } from "../types";

const PRESETS = [
  { label: "Aurora", value: "linear-gradient(160deg, #10243a 0%, #0b2b2a 50%, #060a10 100%)" },
  { label: "Neon", value: "linear-gradient(150deg, #2a0b3d 0%, #4b0f52 48%, #08060f 100%)" },
  { label: "Sunset", value: "linear-gradient(160deg, #3a170f 0%, #52220f 45%, #0b0708 100%)" },
  { label: "Steel", value: "linear-gradient(160deg, #14161c 0%, #1b2029 50%, #07080b 100%)" },
  { label: "Forest", value: "linear-gradient(155deg, #0d2418 0%, #123321 45%, #060a08 100%)" },
  { label: "Candy", value: "linear-gradient(150deg, #3a1130 0%, #3c1436 45%, #0b0610 100%)" },
];

const KINDS: Array<{ id: WallpaperKind; label: string; icon: "sparkle" | "image" | "gif" | "video" }> = [
  { id: "gradient", label: "Градиент", icon: "sparkle" },
  { id: "image", label: "Фото", icon: "image" },
  { id: "gif", label: "GIF", icon: "gif" },
  { id: "video", label: "Видео", icon: "video" },
];

export function ProfileScreen(): JSX.Element {
  const { profile, chats, wallpaper, settings, storageBytes } = useStore();
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const mediaInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    let messages = 0;
    let media = 0;
    for (const chat of chats) {
      messages += chat.messages.length;
      media += chat.messages.filter((m) => m.media).length;
    }
    return { chats: chats.length, messages, media };
  }, [chats]);

  const uploadAvatar = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true);
    try {
      const media = await storeFile(file);
      updateProfile({ avatarMediaId: media.blobId });
      await refreshStorage();
      toast("Аватар обновлён", "ok");
    } catch {
      toast("Не удалось загрузить изображение", "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadWallpaper = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true);
    try {
      const media = await storeFile(file);
      const kind: WallpaperKind =
        media.kind === "video" ? "video" : media.kind === "gif" ? "gif" : "image";
      updateWallpaper({ kind, mediaId: media.blobId, opacity: Math.max(wallpaper.opacity, 0.7) });
      await refreshStorage();
      toast(kind === "video" ? "Видео-фон установлен" : "Фон установлен", "ok");
    } catch {
      toast("Файл не подошёл", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen" data-anim="fade-in">
      <div className="scroll" style={{ paddingBottom: 0 }}>
        <div className="profile-hero">
          <div className="profile-hero__bg">
            <Wallpaper wallpaper={wallpaper} dataSaver={settings.dataSaver} />
          </div>

          <div className="profile-hero__inner">
            <div className="profile-hero__avatar">
              <Avatar name={profile.name} hue={profile.avatarHue} mediaId={profile.avatarMediaId} size={98} />
              <button
                className="profile-hero__camera"
                onClick={() => avatarInput.current?.click()}
                aria-label="Изменить аватар"
                disabled={busy}
              >
                <Icon name="camera" size={16} />
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void uploadAvatar(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <h2 className="profile-hero__name">{profile.name || "Без имени"}</h2>
            <span className="profile-hero__handle">@{profile.username || "username"}</span>
            <p className="profile-hero__bio">{profile.bio}</p>

            <div className="stats" style={{ width: "100%" }}>
              <div className="stat">
                <strong>{stats.chats}</strong>
                <span>чатов</span>
              </div>
              <div className="stat">
                <strong>{stats.messages}</strong>
                <span>сообщений</span>
              </div>
              <div className="stat">
                <strong>{stats.media}</strong>
                <span>медиа</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section-title">Профиль</div>
        <div className="group">
          <label className="field-row">
            <span className="label">Имя</span>
            <input
              value={profile.name}
              maxLength={40}
              onChange={(e) => updateProfile({ name: e.target.value })}
              placeholder="Как вас зовут"
            />
          </label>
          <label className="field-row">
            <span className="label">Имя пользователя</span>
            <input
              value={profile.username}
              maxLength={24}
              onChange={(e) => updateProfile({ username: e.target.value.replace(/\s+/g, "_") })}
              placeholder="username"
            />
          </label>
          <label className="field-row">
            <span className="label">О себе</span>
            <textarea
              rows={2}
              value={profile.bio}
              maxLength={120}
              onChange={(e) => updateProfile({ bio: e.target.value })}
              placeholder="Пара слов о себе"
            />
          </label>
          <div className="row">
            <Icon name="shield" size={20} />
            <div className="row__body">
              <span className="row__title">Номер телефона</span>
              <span className="row__sub">{profile.phone || "—"}</span>
            </div>
          </div>
        </div>

        <div className="section-title">Фон профиля и чатов</div>
        <div className="group">
          <div className="card wp-editor">
            <div className="wp-preview">
              <Wallpaper wallpaper={wallpaper} dataSaver={settings.dataSaver} />
              <div className="wp-preview__bubbles">
                <div className="wp-preview__bubble">Как тебе новый фон? 🎨</div>
                <div className="wp-preview__bubble" data-out="true">
                  Огонь, оставляю 🔥
                </div>
              </div>
            </div>

            <div className="wp-kinds">
              {KINDS.map((kind) => (
                <button
                  key={kind.id}
                  className="wp-kind"
                  data-active={wallpaper.kind === kind.id}
                  onClick={() => {
                    if (kind.id === "gradient") {
                      updateWallpaper({ kind: "gradient", mediaId: undefined });
                      return;
                    }
                    if (kind.id === "image" || kind.id === "gif" || kind.id === "video") {
                      updateWallpaper({ kind: kind.id });
                      mediaInput.current?.click();
                    }
                  }}
                >
                  <Icon name={kind.icon} size={18} />
                  {kind.label}
                </button>
              ))}
            </div>

            <input
              ref={mediaInput}
              type="file"
              accept="image/*,video/*,.gif"
              hidden
              onChange={(e) => {
                void uploadWallpaper(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <button className="btn btn--ghost btn--block" disabled={busy} onClick={() => mediaInput.current?.click()}>
              <Icon name="image" size={18} />
              {busy ? "Загружаем…" : "Загрузить фото, GIF или видео"}
            </button>

            <div>
              <span className="label">Готовые градиенты</span>
              <div className="wp-presets" style={{ marginTop: 8 }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className="wp-preset"
                    title={preset.label}
                    aria-label={preset.label}
                    data-active={wallpaper.gradient === preset.value && wallpaper.kind === "gradient"}
                    style={{ background: preset.value }}
                    onClick={() => updateWallpaper({ kind: "gradient", gradient: preset.value, mediaId: undefined })}
                  />
                ))}
              </div>
            </div>

            <Slider
              label="Видимость фона"
              min={5}
              max={100}
              value={Math.round(wallpaper.opacity * 100)}
              format={(v) => `${v}%`}
              onChange={(v) => updateWallpaper({ opacity: v / 100 })}
            />
            <Slider
              label="Размытие"
              min={0}
              max={40}
              value={wallpaper.blur}
              format={(v) => `${v} px`}
              onChange={(v) => updateWallpaper({ blur: v })}
            />
            <Slider
              label="Затемнение под текст"
              min={0}
              max={90}
              value={Math.round(wallpaper.dim * 100)}
              format={(v) => `${v}%`}
              onChange={(v) => updateWallpaper({ dim: v / 100 })}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn--ghost"
                style={{ flex: 1 }}
                onClick={() =>
                  updateWallpaper({ fit: wallpaper.fit === "cover" ? "contain" : "cover" })
                }
              >
                {wallpaper.fit === "cover" ? "Заполнить" : "Вписать"}
              </button>
              <button
                className="btn btn--ghost"
                style={{ flex: 1 }}
                onClick={() => updateWallpaper({ animated: !wallpaper.animated })}
              >
                {wallpaper.animated ? "Анимация вкл" : "Анимация выкл"}
              </button>
            </div>

            <button
              className="btn btn--ghost btn--block"
              onClick={() => {
                updateWallpaper(DEFAULT_WALLPAPER);
                toast("Фон сброшен", "info");
              }}
            >
              <Icon name="trash" size={16} /> Сбросить фон
            </button>

            <p className="hint">
              Фон хранится в IndexedDB на устройстве и не загружается на сервер. Видео играет
              беззвучно и зациклено; в режиме экономии трафика показывается первый кадр.
            </p>
            <p className="hint">Занято медиа: {Math.round(storageBytes / 1024)} КБ</p>
          </div>
        </div>

        <div className="group">
          <button
            className="row row--tap"
            onClick={() => go({ name: "settings" })}
            style={{ textAlign: "left" }}
          >
            <Icon name="settings" size={20} />
            <div className="row__body">
              <span className="row__title">Настройки</span>
              <span className="row__sub">Тема, акцент, производительность</span>
            </div>
            <Icon name="next" size={18} className="row__chev" />
          </button>
        </div>
        <div style={{ height: 96 }} />
      </div>

      <BottomNav />
    </div>
  );
}
