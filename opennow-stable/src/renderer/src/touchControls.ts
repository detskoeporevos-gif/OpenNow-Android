/**
 * touchControls.ts
 *
 * Declarative description of the on-screen touch controller:
 * layout presets, colour themes, geometry, haptics and the mapping from
 * persisted (flat, Android-friendly) settings keys to a typed config object.
 *
 * Everything here is pure data + helpers -- the rendering lives in
 * components/TouchGamepad.tsx, so the same definitions can be used by the
 * settings preview, the in-stream overlay and the "tune" panel.
 */

import type { Settings } from "@shared/gfn";
import {
  GAMEPAD_A,
  GAMEPAD_B,
  GAMEPAD_X,
  GAMEPAD_Y,
} from "./gfn/inputProtocol";

/* ── Ids ─────────────────────────────────────────────────────────── */

export type TouchLayoutId =
  | "classic"
  | "compact"
  | "split"
  | "fps"
  | "twin"
  | "arcade"
  | "clean"
  | "thumb"
  | "custom";

export type TouchThemeId =
  | "obsidian"
  | "aurora"
  | "ember"
  | "neon"
  | "ice"
  | "xbox"
  | "playstation"
  | "matrix"
  | "sakura"
  | "gold";

export type TouchFaceStyle = "xbox" | "playstation" | "nintendo" | "letters";
export type TouchTriggerStyle = "buttons" | "analog";
export type TouchHapticStyle = "off" | "light" | "medium" | "strong";

export type TouchClusterId =
  | "dpad"
  | "leftStick"
  | "rightStick"
  | "face"
  | "shouldersLeft"
  | "shouldersRight"
  | "centre";

export const TOUCH_CLUSTER_IDS: TouchClusterId[] = [
  "dpad",
  "leftStick",
  "rightStick",
  "face",
  "shouldersLeft",
  "shouldersRight",
  "centre",
];

export interface TouchPoint {
  /** Horizontal position in percent of the overlay (0 = left, 100 = right). */
  x: number;
  /** Vertical position in percent of the overlay (0 = top, 100 = bottom). */
  y: number;
}

export type TouchPositions = Record<TouchClusterId, TouchPoint>;

/* ── Config ──────────────────────────────────────────────────────── */

export interface TouchControlsConfig {
  enabled: boolean;
  layout: TouchLayoutId;
  theme: TouchThemeId;
  faceStyle: TouchFaceStyle;
  triggerStyle: TouchTriggerStyle;
  haptics: TouchHapticStyle;
  /** Overall overlay scale (1 = 100%). */
  scale: number;
  /** Overlay opacity (1 = fully opaque). */
  opacity: number;
  /** Multiplier applied to buttons / dpad / shoulders. */
  buttonScale: number;
  /** Multiplier applied to thumbsticks. */
  stickScale: number;
  /** Radial deadzone 0..0.35. */
  deadzone: number;
  /** Stick travel multiplier 0.6..1.6. */
  sensitivity: number;
  invertLeftY: boolean;
  invertRightY: boolean;
  swapSticks: boolean;
  leftHanded: boolean;
  showDpad: boolean;
  showFace: boolean;
  showShoulders: boolean;
  showCentre: boolean;
  showLeftStick: boolean;
  showRightStick: boolean;
  showTuneButton: boolean;
  /** User dragged positions -- only used by the "custom" layout. */
  customPositions: Partial<Record<TouchClusterId, TouchPoint>> | null;
}

export const DEFAULT_TOUCH_CONTROLS: TouchControlsConfig = {
  enabled: true,
  layout: "classic",
  theme: "obsidian",
  faceStyle: "xbox",
  triggerStyle: "analog",
  haptics: "light",
  scale: 1,
  opacity: 0.85,
  buttonScale: 1,
  stickScale: 1,
  deadzone: 0.12,
  sensitivity: 1,
  invertLeftY: false,
  invertRightY: false,
  swapSticks: false,
  leftHanded: false,
  showDpad: true,
  showFace: true,
  showShoulders: true,
  showCentre: true,
  showLeftStick: true,
  showRightStick: true,
  showTuneButton: true,
  customPositions: null,
};

/* ── Layout presets ──────────────────────────────────────────────── */

export interface TouchLayoutPreset {
  id: TouchLayoutId;
  name: string;
  blurb: string;
  positions: TouchPositions;
  /** Clusters this preset hides by default (on top of user toggles). */
  hidden?: TouchClusterId[];
}

const BASE_POSITIONS: TouchPositions = {
  dpad: { x: 14, y: 74 },
  leftStick: { x: 31, y: 89 },
  rightStick: { x: 69, y: 89 },
  face: { x: 86, y: 74 },
  shouldersLeft: { x: 15, y: 56 },
  shouldersRight: { x: 85, y: 56 },
  centre: { x: 50, y: 93 },
};

export const TOUCH_LAYOUTS: TouchLayoutPreset[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "D-pad + stick on the left, face buttons + stick on the right.",
    positions: { ...BASE_POSITIONS },
  },
  {
    id: "compact",
    name: "Compact",
    blurb: "Everything tucked into the bottom corners for small phones.",
    positions: {
      dpad: { x: 11, y: 79 },
      leftStick: { x: 25, y: 92 },
      rightStick: { x: 75, y: 92 },
      face: { x: 89, y: 79 },
      shouldersLeft: { x: 12, y: 62 },
      shouldersRight: { x: 88, y: 62 },
      centre: { x: 50, y: 97 },
    },
  },
  {
    id: "split",
    name: "Split",
    blurb: "Sticks in the bottom corners, face/D-pad higher up, bumpers top.",
    positions: {
      dpad: { x: 30, y: 79 },
      leftStick: { x: 13, y: 88 },
      rightStick: { x: 87, y: 88 },
      face: { x: 70, y: 79 },
      shouldersLeft: { x: 13, y: 16 },
      shouldersRight: { x: 87, y: 16 },
      centre: { x: 50, y: 95 },
    },
  },
  {
    id: "fps",
    name: "Shooter",
    blurb: "One movement stick, big face cluster, triggers under your index fingers.",
    positions: {
      dpad: { x: 14, y: 74 },
      leftStick: { x: 14, y: 84 },
      rightStick: { x: 70, y: 88 },
      face: { x: 88, y: 77 },
      shouldersLeft: { x: 17, y: 44 },
      shouldersRight: { x: 83, y: 44 },
      centre: { x: 50, y: 97 },
    },
    hidden: ["dpad", "rightStick"],
  },
  {
    id: "twin",
    name: "Twin sticks",
    blurb: "Both sticks low and centred, buttons up top -- twin-stick games.",
    positions: {
      dpad: { x: 15, y: 56 },
      leftStick: { x: 15, y: 86 },
      rightStick: { x: 85, y: 86 },
      face: { x: 85, y: 56 },
      shouldersLeft: { x: 16, y: 27 },
      shouldersRight: { x: 84, y: 27 },
      centre: { x: 50, y: 96 },
    },
  },
  {
    id: "arcade",
    name: "Arcade",
    blurb: "Large D-pad and buttons, no sticks -- fighters and retro titles.",
    positions: {
      dpad: { x: 16, y: 71 },
      leftStick: { x: 31, y: 89 },
      rightStick: { x: 69, y: 89 },
      face: { x: 84, y: 71 },
      shouldersLeft: { x: 17, y: 40 },
      shouldersRight: { x: 83, y: 40 },
      centre: { x: 50, y: 93 },
    },
    hidden: ["leftStick", "rightStick"],
  },
  {
    id: "clean",
    name: "Clean",
    blurb: "Minimal sticks + face buttons only, for HUD-heavy games.",
    positions: {
      dpad: { x: 14, y: 74 },
      leftStick: { x: 14, y: 87 },
      rightStick: { x: 86, y: 87 },
      face: { x: 86, y: 65 },
      shouldersLeft: { x: 15, y: 48 },
      shouldersRight: { x: 85, y: 48 },
      centre: { x: 50, y: 97 },
    },
    hidden: ["dpad", "shouldersLeft", "shouldersRight"],
  },
  {
    id: "thumb",
    name: "Thumb pads",
    blurb: "Face buttons and D-pad close to your thumbs, sticks outward.",
    positions: {
      dpad: { x: 27, y: 84 },
      leftStick: { x: 12, y: 82 },
      rightStick: { x: 88, y: 82 },
      face: { x: 73, y: 84 },
      shouldersLeft: { x: 13, y: 55 },
      shouldersRight: { x: 87, y: 55 },
      centre: { x: 50, y: 96 },
    },
  },
  {
    id: "custom",
    name: "Custom",
    blurb: "Your own dragged-out layout -- edit it from the Tune panel in-stream.",
    positions: { ...BASE_POSITIONS },
  },
];

export function getLayoutPreset(id: TouchLayoutId | undefined): TouchLayoutPreset {
  return TOUCH_LAYOUTS.find((l) => l.id === id) ?? TOUCH_LAYOUTS[0];
}

/* ── Themes ──────────────────────────────────────────────────────── */

export interface TouchThemeVars {
  accent: string;
  accentSoft: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  borderStrong: string;
  knob: string;
  text: string;
  glow: string;
  faceA: string;
  faceB: string;
  faceX: string;
  faceY: string;
}

export interface TouchTheme {
  id: TouchThemeId;
  name: string;
  vars: TouchThemeVars;
}

const XBOX_FACES = { faceA: "#58d98a", faceB: "#e05c5c", faceX: "#5b9bd5", faceY: "#f5c518" };

export const TOUCH_THEMES: TouchTheme[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    vars: {
      accent: "#e6e6ec",
      accentSoft: "rgba(255,255,255,0.16)",
      surface: "rgba(16,16,20,0.62)",
      surfaceStrong: "rgba(38,38,46,0.92)",
      border: "rgba(255,255,255,0.26)",
      borderStrong: "rgba(255,255,255,0.65)",
      knob: "rgba(236,236,239,0.82)",
      text: "#f2f2f5",
      glow: "rgba(255,255,255,0.18)",
      ...XBOX_FACES,
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    vars: {
      accent: "#58d98a",
      accentSoft: "rgba(88,217,138,0.20)",
      surface: "rgba(9,26,19,0.62)",
      surfaceStrong: "rgba(24,62,45,0.92)",
      border: "rgba(88,217,138,0.42)",
      borderStrong: "rgba(106,232,154,0.9)",
      knob: "rgba(88,217,138,0.85)",
      text: "#eafff2",
      glow: "rgba(88,217,138,0.35)",
      ...XBOX_FACES,
    },
  },
  {
    id: "ember",
    name: "Ember",
    vars: {
      accent: "#ff8b4d",
      accentSoft: "rgba(255,139,77,0.20)",
      surface: "rgba(30,14,10,0.62)",
      surfaceStrong: "rgba(74,32,18,0.92)",
      border: "rgba(255,139,77,0.42)",
      borderStrong: "rgba(255,166,113,0.9)",
      knob: "rgba(255,139,77,0.85)",
      text: "#fff1e8",
      glow: "rgba(255,139,77,0.35)",
      ...XBOX_FACES,
    },
  },
  {
    id: "neon",
    name: "Neon",
    vars: {
      accent: "#ff57d2",
      accentSoft: "rgba(255,87,210,0.20)",
      surface: "rgba(20,8,26,0.62)",
      surfaceStrong: "rgba(56,16,66,0.92)",
      border: "rgba(255,87,210,0.45)",
      borderStrong: "rgba(255,126,222,0.9)",
      knob: "rgba(255,87,210,0.85)",
      text: "#ffe9fb",
      glow: "rgba(255,87,210,0.38)",
      faceA: "#7af5ff",
      faceB: "#ff57d2",
      faceX: "#a97bff",
      faceY: "#ffe066",
    },
  },
  {
    id: "ice",
    name: "Ice",
    vars: {
      accent: "#66c8ff",
      accentSoft: "rgba(102,200,255,0.20)",
      surface: "rgba(8,20,30,0.62)",
      surfaceStrong: "rgba(18,54,80,0.92)",
      border: "rgba(102,200,255,0.42)",
      borderStrong: "rgba(140,216,255,0.9)",
      knob: "rgba(102,200,255,0.85)",
      text: "#eaf7ff",
      glow: "rgba(102,200,255,0.35)",
      ...XBOX_FACES,
    },
  },
  {
    id: "xbox",
    name: "Xbox",
    vars: {
      accent: "#9bf00b",
      accentSoft: "rgba(155,240,11,0.18)",
      surface: "rgba(10,22,10,0.66)",
      surfaceStrong: "rgba(28,58,20,0.94)",
      border: "rgba(155,240,11,0.42)",
      borderStrong: "rgba(180,255,60,0.9)",
      knob: "rgba(155,240,11,0.8)",
      text: "#f2ffe3",
      glow: "rgba(155,240,11,0.32)",
      faceA: "#6ddc5b",
      faceB: "#e3564f",
      faceX: "#4a90e2",
      faceY: "#f2c730",
    },
  },
  {
    id: "playstation",
    name: "PlayStation",
    vars: {
      accent: "#7aa7ff",
      accentSoft: "rgba(122,167,255,0.20)",
      surface: "rgba(9,14,28,0.66)",
      surfaceStrong: "rgba(24,40,76,0.94)",
      border: "rgba(122,167,255,0.42)",
      borderStrong: "rgba(160,196,255,0.9)",
      knob: "rgba(160,196,255,0.85)",
      text: "#eef4ff",
      glow: "rgba(122,167,255,0.34)",
      faceA: "#7ea6ff",
      faceB: "#ff7b8a",
      faceX: "#ff9ef0",
      faceY: "#6fe3c4",
    },
  },
  {
    id: "matrix",
    name: "Matrix",
    vars: {
      accent: "#3dff7a",
      accentSoft: "rgba(61,255,122,0.16)",
      surface: "rgba(0,12,4,0.72)",
      surfaceStrong: "rgba(0,40,14,0.94)",
      border: "rgba(61,255,122,0.45)",
      borderStrong: "rgba(120,255,170,0.92)",
      knob: "rgba(61,255,122,0.9)",
      text: "#d9ffe6",
      glow: "rgba(61,255,122,0.4)",
      faceA: "#3dff7a",
      faceB: "#1fd65e",
      faceX: "#7dffab",
      faceY: "#b6ffd0",
    },
  },
  {
    id: "sakura",
    name: "Sakura",
    vars: {
      accent: "#ff9ec7",
      accentSoft: "rgba(255,158,199,0.20)",
      surface: "rgba(30,12,22,0.62)",
      surfaceStrong: "rgba(74,28,50,0.92)",
      border: "rgba(255,158,199,0.42)",
      borderStrong: "rgba(255,190,216,0.9)",
      knob: "rgba(255,158,199,0.88)",
      text: "#fff0f6",
      glow: "rgba(255,158,199,0.36)",
      faceA: "#ff9ec7",
      faceB: "#ff7a9c",
      faceX: "#c9a7ff",
      faceY: "#ffe08a",
    },
  },
  {
    id: "gold",
    name: "Gold",
    vars: {
      accent: "#f2c96b",
      accentSoft: "rgba(242,201,107,0.20)",
      surface: "rgba(26,20,8,0.64)",
      surfaceStrong: "rgba(66,50,16,0.94)",
      border: "rgba(242,201,107,0.45)",
      borderStrong: "rgba(255,222,150,0.92)",
      knob: "rgba(242,201,107,0.88)",
      text: "#fff8e6",
      glow: "rgba(242,201,107,0.36)",
      ...XBOX_FACES,
    },
  },
];

export function getTheme(id: TouchThemeId | undefined): TouchTheme {
  return TOUCH_THEMES.find((t) => t.id === id) ?? TOUCH_THEMES[0];
}

/* ── Face button styles ─────────────────────────────────────────── */

export interface FaceButtonSpec {
  flag: number;
  label: string;
  colorKey: "faceA" | "faceB" | "faceX" | "faceY";
}

export interface FaceMap {
  top: FaceButtonSpec;
  left: FaceButtonSpec;
  right: FaceButtonSpec;
  bottom: FaceButtonSpec;
}

export function getFaceMap(style: TouchFaceStyle): FaceMap {
  switch (style) {
    case "nintendo":
      return {
        top: { flag: GAMEPAD_X, label: "X", colorKey: "faceX" },
        left: { flag: GAMEPAD_Y, label: "Y", colorKey: "faceY" },
        right: { flag: GAMEPAD_A, label: "A", colorKey: "faceA" },
        bottom: { flag: GAMEPAD_B, label: "B", colorKey: "faceB" },
      };
    case "playstation":
      return {
        top: { flag: GAMEPAD_Y, label: "△", colorKey: "faceY" },
        left: { flag: GAMEPAD_X, label: "□", colorKey: "faceX" },
        right: { flag: GAMEPAD_B, label: "○", colorKey: "faceB" },
        bottom: { flag: GAMEPAD_A, label: "✕", colorKey: "faceA" },
      };
    case "letters":
      return {
        top: { flag: GAMEPAD_Y, label: "Y", colorKey: "faceY" },
        left: { flag: GAMEPAD_X, label: "X", colorKey: "faceX" },
        right: { flag: GAMEPAD_B, label: "B", colorKey: "faceB" },
        bottom: { flag: GAMEPAD_A, label: "A", colorKey: "faceA" },
      };
    case "xbox":
    default:
      return {
        top: { flag: GAMEPAD_Y, label: "Y", colorKey: "faceY" },
        left: { flag: GAMEPAD_X, label: "X", colorKey: "faceX" },
        right: { flag: GAMEPAD_B, label: "B", colorKey: "faceB" },
        bottom: { flag: GAMEPAD_A, label: "A", colorKey: "faceA" },
      };
  }
}

/* ── Haptics ─────────────────────────────────────────────────────── */

export const TOUCH_HAPTIC_OPTIONS: Array<{ value: TouchHapticStyle; label: string; ms: number }> = [
  { value: "off", label: "Off", ms: 0 },
  { value: "light", label: "Light", ms: 8 },
  { value: "medium", label: "Medium", ms: 14 },
  { value: "strong", label: "Strong", ms: 24 },
];

export function hapticPulse(style: TouchHapticStyle, boost = 1): void {
  if (style === "off") return;
  const option = TOUCH_HAPTIC_OPTIONS.find((o) => o.value === style);
  const ms = Math.round((option?.ms ?? 0) * boost);
  if (ms <= 0) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* vibration unavailable -- never break input for haptics */
  }
}

/* ── Settings <-> config ─────────────────────────────────────────── */

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

const LAYOUT_IDS: TouchLayoutId[] = TOUCH_LAYOUTS.map((l) => l.id);
const THEME_IDS: TouchThemeId[] = TOUCH_THEMES.map((t) => t.id);
const FACE_STYLES: TouchFaceStyle[] = ["xbox", "playstation", "nintendo", "letters"];
const TRIGGER_STYLES: TouchTriggerStyle[] = ["buttons", "analog"];
const HAPTIC_STYLES: TouchHapticStyle[] = TOUCH_HAPTIC_OPTIONS.map((o) => o.value);

function parseCustomPositions(raw: unknown): Partial<Record<TouchClusterId, TouchPoint>> | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<TouchClusterId, TouchPoint>> = {};
    for (const id of TOUCH_CLUSTER_IDS) {
      const entry = parsed?.[id];
      if (!entry || typeof entry !== "object") continue;
      const x = Number((entry as TouchPoint).x);
      const y = Number((entry as TouchPoint).y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out[id] = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Turn the persisted (flat) settings bag into a typed config.
 * Every value is clamped so a hand-edited settings file can't break the UI.
 */
export function readTouchControls(settings: Partial<Settings> | null | undefined): TouchControlsConfig {
  const s = settings ?? {};
  const defaults = DEFAULT_TOUCH_CONTROLS;
  return {
    enabled: pickBool(s.touchControlsEnabled, defaults.enabled),
    layout: pick(s.touchLayout, LAYOUT_IDS, defaults.layout),
    theme: pick(s.touchTheme, THEME_IDS, defaults.theme),
    faceStyle: pick(s.touchFaceStyle, FACE_STYLES, defaults.faceStyle),
    triggerStyle: pick(s.touchTriggerStyle, TRIGGER_STYLES, defaults.triggerStyle),
    haptics: pick(s.touchHaptics, HAPTIC_STYLES, defaults.haptics),
    scale: clampInt(s.touchScalePercent, 100, 60, 160) / 100,
    opacity: clampInt(s.touchOpacityPercent, 85, 25, 100) / 100,
    buttonScale: clampInt(s.touchButtonSizePercent, 100, 70, 150) / 100,
    stickScale: clampInt(s.touchStickSizePercent, 100, 70, 150) / 100,
    deadzone: clampInt(s.touchDeadzonePercent, 12, 0, 35) / 100,
    sensitivity: clampInt(s.touchSensitivityPercent, 100, 60, 170) / 100,
    invertLeftY: pickBool(s.touchInvertLeftY, defaults.invertLeftY),
    invertRightY: pickBool(s.touchInvertRightY, defaults.invertRightY),
    swapSticks: pickBool(s.touchSwapSticks, defaults.swapSticks),
    leftHanded: pickBool(s.touchLeftHanded, defaults.leftHanded),
    showDpad: pickBool(s.touchShowDpad, defaults.showDpad),
    showFace: pickBool(s.touchShowFace, defaults.showFace),
    showShoulders: pickBool(s.touchShowShoulders, defaults.showShoulders),
    showCentre: pickBool(s.touchShowCentre, defaults.showCentre),
    showLeftStick: pickBool(s.touchShowLeftStick, defaults.showLeftStick),
    showRightStick: pickBool(s.touchShowRightStick, defaults.showRightStick),
    showTuneButton: pickBool(s.touchShowTuneButton, defaults.showTuneButton),
    customPositions: parseCustomPositions(s.touchCustomPositions),
  };
}

/** Serialise dragged positions for persistence. */
export function serializePositions(positions: Partial<Record<TouchClusterId, TouchPoint>>): string {
  const rounded: Record<string, TouchPoint> = {};
  for (const id of TOUCH_CLUSTER_IDS) {
    const point = positions[id];
    if (!point) continue;
    rounded[id] = {
      x: Math.round(point.x * 10) / 10,
      y: Math.round(point.y * 10) / 10,
    };
  }
  return JSON.stringify(rounded);
}

/* ── Resolution helpers ──────────────────────────────────────────── */

/** Mirror a point horizontally (used by left-handed mode). */
function mirrorPoint(point: TouchPoint): TouchPoint {
  return { x: 100 - point.x, y: point.y };
}

/**
 * Final on-screen position (percent) for every cluster, applying the preset,
 * custom drags and left-handed mirroring.
 */
export function resolvePositions(config: TouchControlsConfig): TouchPositions {
  const preset = getLayoutPreset(config.layout);
  let merged: TouchPositions = { ...preset.positions };

  // Left-handed mode mirrors the preset: the left thumb's controls move to the
  // right side of the screen and vice versa.
  if (config.leftHanded) {
    merged = {
      dpad: mirrorPoint(merged.face),
      face: mirrorPoint(merged.dpad),
      leftStick: mirrorPoint(merged.rightStick),
      rightStick: mirrorPoint(merged.leftStick),
      shouldersLeft: mirrorPoint(merged.shouldersRight),
      shouldersRight: mirrorPoint(merged.shouldersLeft),
      centre: { x: 100 - merged.centre.x, y: merged.centre.y },
    };
  }

  // Dragged positions are stored in final (on-screen) coordinates and only
  // apply to the Custom layout, so picking a preset always snaps back to it.
  if (config.layout === "custom" && config.customPositions) {
    for (const id of TOUCH_CLUSTER_IDS) {
      const custom = config.customPositions[id];
      if (custom) merged[id] = custom;
    }
  }

  return merged;
}

/** Which clusters are visible for this config. */
export function visibleClusters(config: TouchControlsConfig): Record<TouchClusterId, boolean> {
  const preset = getLayoutPreset(config.layout);
  const hiddenByPreset = new Set(preset.hidden ?? []);
  const allow = (id: TouchClusterId, userWants: boolean): boolean =>
    userWants && !hiddenByPreset.has(id);

  return {
    dpad: allow("dpad", config.showDpad),
    leftStick: allow("leftStick", config.showLeftStick),
    rightStick: allow("rightStick", config.showRightStick),
    face: allow("face", config.showFace),
    shouldersLeft: allow("shouldersLeft", config.showShoulders),
    shouldersRight: allow("shouldersRight", config.showShoulders),
    centre: allow("centre", config.showCentre),
  };
}

/** Theme + geometry as CSS custom properties for the overlay root. */
export function touchCssVars(config: TouchControlsConfig): Record<string, string> {
  const theme = getTheme(config.theme);
  return {
    "--tgp-accent": theme.vars.accent,
    "--tgp-accent-soft": theme.vars.accentSoft,
    "--tgp-surface": theme.vars.surface,
    "--tgp-surface-strong": theme.vars.surfaceStrong,
    "--tgp-border": theme.vars.border,
    "--tgp-border-strong": theme.vars.borderStrong,
    "--tgp-knob": theme.vars.knob,
    "--tgp-text": theme.vars.text,
    "--tgp-glow": theme.vars.glow,
    "--tgp-face-a": theme.vars.faceA,
    "--tgp-face-b": theme.vars.faceB,
    "--tgp-face-x": theme.vars.faceX,
    "--tgp-face-y": theme.vars.faceY,
    "--tgp-scale": String(config.scale),
    "--tgp-btn-scale": String(config.buttonScale),
    "--tgp-stick-scale": String(config.stickScale),
    "--tgp-opacity": String(config.opacity),
  };
}

/** Apply a radial deadzone and clamp. */
export function shapeStickInput(
  x: number,
  y: number,
  deadzone: number,
  sensitivity: number,
): { x: number; y: number } {
  const sx = Math.max(-1, Math.min(1, x * sensitivity));
  const sy = Math.max(-1, Math.min(1, y * sensitivity));
  const magnitude = Math.hypot(sx, sy);
  if (magnitude <= deadzone || magnitude === 0) {
    return { x: 0, y: 0 };
  }
  const scaled = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  return {
    x: (sx / magnitude) * scaled,
    y: (sy / magnitude) * scaled,
  };
}
