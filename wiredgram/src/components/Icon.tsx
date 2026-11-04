/** Inline SVG icon set — ~20 icons, no icon font, no lucide payload. */
import type { JSX } from "react";

export type IconName =
  | "chat"
  | "user"
  | "settings"
  | "search"
  | "back"
  | "next"
  | "down"
  | "send"
  | "attach"
  | "camera"
  | "image"
  | "video"
  | "gif"
  | "sparkle"
  | "pin"
  | "bellOff"
  | "more"
  | "close"
  | "trash"
  | "logout"
  | "palette"
  | "bolt"
  | "storage"
  | "lock"
  | "shield"
  | "plus"
  | "check"
  | "checks"
  | "smile"
  | "play"
  | "eye"
  | "eyeOff"
  | "wired";

const P: Record<IconName, JSX.Element> = {
  wired: (
    <path d="M4 7.5 7.5 18 12 9.5 16.5 18 20 7.5" strokeLinecap="round" strokeLinejoin="round" />
  ),
  chat: (
    <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-4.5 3.5V16A3 3 0 0 1 4 13z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h4M12 17h8" strokeLinecap="round" />
      <path d="M15 4.5v5M9 14.5v5" strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m16.2 16.2 4 4" strokeLinecap="round" />
    </>
  ),
  back: <path d="M14.5 5 8 12l6.5 7" strokeLinecap="round" strokeLinejoin="round" />,
  next: <path d="M9.5 5 16 12l-6.5 7" strokeLinecap="round" strokeLinejoin="round" />,
  down: (
    <>
      <path d="M12 5v12" strokeLinecap="round" />
      <path d="m6.8 12.6 5.2 5 5.2-5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  send: <path d="M4.6 11.6 19.6 4.6 13.4 20l-2.4-6.2z" strokeLinejoin="round" />,
  attach: (
    <path
      d="M17.6 8.4 9.9 16a3.6 3.6 0 0 0 5.1 5.1l6.3-6.3a6 6 0 0 0-8.5-8.5l-6.9 6.9a8.4 8.4 0 0 0 11.9 11.9l3.3-3.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(2.5 -2.5) scale(.82)"
    />
  ),
  camera: (
    <>
      <path d="M3.5 9A2.5 2.5 0 0 1 6 6.5h1.6L9 4.4h6l1.4 2.1H18A2.5 2.5 0 0 1 20.5 9v7.5A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  image: (
    <>
      <rect x="3.6" y="4.6" width="16.8" height="14.8" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 4.4-4.2L13 16l2.6-2.4L19 17" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  video: (
    <>
      <rect x="3.6" y="5.6" width="12.8" height="12.8" rx="3" />
      <path d="m16.6 11 3.8-2.6v7.2L16.6 13z" strokeLinejoin="round" />
    </>
  ),
  gif: (
    <>
      <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="3" />
      <path d="M10.4 10.4H8.6a1.6 1.6 0 0 0-1.6 1.6 1.6 1.6 0 0 0 1.6 1.6h1.4v-1.6M12.8 10.2v5.4M15.2 15.6v-5.4h2.4M15.2 13h2" strokeLinecap="round" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 4 1.9 4.6L18.5 10l-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.4z" strokeLinejoin="round" />
      <path d="M17.8 15.4l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" strokeLinejoin="round" />
    </>
  ),
  pin: (
    <path d="M9.4 3.8h5.2l-1 5.2 2.8 2.8H7.6l2.8-2.8zM12 11.8V20" strokeLinecap="round" strokeLinejoin="round" />
  ),
  bellOff: (
    <>
      <path d="M6.4 9.6a5.6 5.6 0 0 1 9.3-4.1M18 13.4V11a6 6 0 0 0-1.6-4" strokeLinecap="round" />
      <path d="M5.5 18h13l-1.7-2.3H7.2z" strokeLinejoin="round" />
      <path d="M4 4l16 16" strokeLinecap="round" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" strokeLinecap="round" />
      <path d="M6.5 7l.9 11.2A2 2 0 0 0 9.4 20h5.2a2 2 0 0 0 2-1.8L17.5 7" strokeLinecap="round" />
    </>
  ),
  logout: (
    <>
      <path d="M15 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
      <path d="M10.5 8 6.5 12l4 4M6.5 12H16" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  palette: (
    <>
      <path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2.2-1.8 3.2-3.6 3.2h-1.6a1.9 1.9 0 0 0-1.3 3.3c.5.6.2 2-2 2z" />
      <circle cx="8.4" cy="10.4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="9.8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13.4 3 5.5 13.8h5.4L10 21l8-11h-5.4z" strokeLinejoin="round" />,
  storage: (
    <>
      <ellipse cx="12" cy="6.4" rx="7.4" ry="2.9" />
      <path d="M4.6 6.4v11.2c0 1.6 3.3 2.9 7.4 2.9s7.4-1.3 7.4-2.9V6.4" />
      <path d="M4.6 12c0 1.6 3.3 2.9 7.4 2.9s7.4-1.3 7.4-2.9" />
    </>
  ),
  lock: (
    <>
      <rect x="4.8" y="10.4" width="14.4" height="9.4" rx="2.6" />
      <path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4" strokeLinecap="round" />
    </>
  ),
  shield: (
    <path d="M12 3.6 19 6v6c0 4.2-3 7-7 8.4C8 19 5 16.2 5 12V6z" strokeLinejoin="round" />
  ),
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  check: <path d="M5 12.6 9.6 17 19 7.4" strokeLinecap="round" strokeLinejoin="round" />,
  checks: (
    <path d="M3 12.4 6.8 16 14 8M11 16l.8.8L20 8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0" strokeLinecap="round" />
      <circle cx="9.3" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="10" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  play: <path d="M8.5 5.6 18 12l-9.5 6.4z" strokeLinejoin="round" />,
  eye: (
    <>
      <path d="M2.8 12S6.4 5.8 12 5.8 21.2 12 21.2 12 17.6 18.2 12 18.2 2.8 12 2.8 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4.4 8.2A15 15 0 0 0 2.8 12S6.4 18.2 12 18.2a9.6 9.6 0 0 0 3.5-.7M9.4 6.2A9.4 9.4 0 0 1 12 5.8c5.6 0 9.2 6.2 9.2 6.2a16 16 0 0 1-2.6 3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4l16 16" strokeLinecap="round" />
    </>
  ),
};

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
