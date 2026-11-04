import type { JSX } from "react";
import { hueGradient, initials } from "../lib/format";
import { useMediaUrl } from "../lib/media";

export function Avatar({
  name,
  hue,
  mediaId,
  size = 52,
  online = false,
  radius,
}: {
  name: string;
  hue: number;
  mediaId?: string;
  size?: number;
  online?: boolean;
  radius?: number;
}): JSX.Element {
  const url = useMediaUrl(mediaId);
  return (
    <div
      className={`avatar${online ? " avatar--online" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: url ? undefined : hueGradient(hue),
        borderRadius: radius ?? "50%",
      }}
    >
      {url ? <img src={url} alt={name} loading="lazy" decoding="async" /> : initials(name)}
    </div>
  );
}
