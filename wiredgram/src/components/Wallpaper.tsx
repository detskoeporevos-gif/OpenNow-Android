import type { JSX } from "react";
import { useMediaUrl } from "../lib/media";
import type { Wallpaper as WallpaperModel } from "../types";

/** Renders the chat wallpaper stack: media + blur + opacity + scrim. */
export function Wallpaper({
  wallpaper,
  dataSaver,
  className = "",
}: {
  wallpaper: WallpaperModel;
  dataSaver?: boolean;
  className?: string;
}): JSX.Element {
  const url = useMediaUrl(wallpaper.mediaId);
  const showMedia = wallpaper.kind !== "none" && wallpaper.kind !== "gradient" && !!url;

  const mediaStyle: React.CSSProperties = {
    opacity: wallpaper.opacity,
    filter: wallpaper.blur > 0 ? `blur(${wallpaper.blur}px)` : undefined,
    transform: wallpaper.blur > 0 ? "scale(1.08)" : undefined,
    objectFit: wallpaper.fit,
  };

  return (
    <div className={`wallpaper ${className}`} aria-hidden="true">
      {/* Always paint the gradient underneath so there is never a black flash. */}
      <div
        className="wallpaper__layer"
        style={{ background: wallpaper.gradient, opacity: showMedia ? 0.6 : 1 }}
      />

      {showMedia && wallpaper.kind !== "video" && (
        <img className="wallpaper__layer" src={url} alt="" style={mediaStyle} decoding="async" />
      )}

      {showMedia && wallpaper.kind === "video" && (
        <video
          className="wallpaper__layer"
          src={url}
          style={mediaStyle}
          autoPlay={!dataSaver}
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}

      <div className="wallpaper__scrim" style={{ opacity: wallpaper.dim }} />
      <div className="wallpaper__vignette" />
    </div>
  );
}
