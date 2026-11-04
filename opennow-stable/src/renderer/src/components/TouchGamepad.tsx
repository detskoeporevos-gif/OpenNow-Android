/**
 * TouchGamepad.tsx
 *
 * Fully customisable on-screen gamepad for Android / touch devices.
 *
 * What it renders (each cluster can be shown/hidden, themed, resized and
 * dragged around by the player):
 *   - D-pad (radial, diagonals supported)
 *   - Two analog thumbsticks (draggable, deadzone + sensitivity + invert-Y)
 *   - Face buttons A B X Y (Xbox / PlayStation / Nintendo / letters glyphs)
 *   - Bumpers LB/RB and analog triggers LT/RT (tap or drag)
 *   - Back / Guide / Start
 *
 * All input is forwarded to GfnWebRtcClient through the public touch helpers.
 * The component is invisible on desktop -- App only mounts it on Android
 * while a stream is running.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Move, RotateCcw, SlidersHorizontal, X } from "lucide-react";

import type { Settings } from "@shared/gfn";
import type { GfnWebRtcClient } from "../gfn/webrtcClient";
import {
  GAMEPAD_A, GAMEPAD_B, GAMEPAD_X, GAMEPAD_Y,
  GAMEPAD_LB, GAMEPAD_RB,
  GAMEPAD_DPAD_UP, GAMEPAD_DPAD_DOWN, GAMEPAD_DPAD_LEFT, GAMEPAD_DPAD_RIGHT,
  GAMEPAD_START, GAMEPAD_BACK, GAMEPAD_GUIDE,
} from "../gfn/inputProtocol";
import {
  DEFAULT_TOUCH_CONTROLS,
  TOUCH_LAYOUTS,
  TOUCH_THEMES,
  getFaceMap,
  getTheme,
  hapticPulse,
  readTouchControls,
  resolvePositions,
  serializePositions,
  shapeStickInput,
  touchCssVars,
  visibleClusters,
  type TouchClusterId,
  type TouchControlsConfig,
  type TouchPoint,
} from "../touchControls";

/* ── Public props ────────────────────────────────────────────────── */

interface Props {
  clientRef: React.RefObject<GfnWebRtcClient | null>;
  visible: boolean;
  /** Persisted app settings -- the touch config is derived from these. */
  settings?: Partial<Settings>;
  /** Persist a single setting change (same signature as App.updateSetting). */
  onSettingChange?: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Render as a static, non-interactive preview (settings page). */
  inline?: boolean;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const FACE_COLOR_VARS = {
  faceA: "--tgp-face-a",
  faceB: "--tgp-face-b",
  faceX: "--tgp-face-x",
  faceY: "--tgp-face-y",
} as const;

function faceColorVar(spec: { colorKey: keyof typeof FACE_COLOR_VARS }): string {
  return FACE_COLOR_VARS[spec.colorKey];
}

/* ── Cluster wrapper (handles drag-to-move in edit mode) ─────────── */

interface ClusterProps {
  id: TouchClusterId;
  position: TouchPoint;
  editing: boolean;
  className?: string;
  onDragStart?: (id: TouchClusterId, clientX: number, clientY: number) => void;
  children: React.ReactNode;
}

function Cluster({ id, position, editing, className, onDragStart, children }: ClusterProps): JSX.Element {
  return (
    <div
      className={`tgp-cluster${editing ? " tgp-cluster--editing" : ""}${className ? ` ${className}` : ""}`}
      data-cluster={id}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onTouchStart={(e) => {
        if (!editing) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        e.preventDefault();
        e.stopPropagation();
        onDragStart?.(id, touch.clientX, touch.clientY);
      }}
    >
      {editing && (
        <span className="tgp-cluster-handle" aria-hidden="true">
          <Move size={12} />
        </span>
      )}
      <div className="tgp-cluster-body" style={editing ? { pointerEvents: "none" } : undefined}>
        {children}
      </div>
    </div>
  );
}

/* ── Face button ─────────────────────────────────────────────────── */

interface FaceButtonProps {
  label: string;
  /** CSS custom property name holding the button colour, e.g. --tgp-face-a */
  colorVar: string;
  /** Diamond position inside the face cluster. */
  posClass: string;
  xinputFlag: number;
  config: TouchControlsConfig;
  clientRef: React.RefObject<GfnWebRtcClient | null>;
  interactive: boolean;
}

function FaceButton({ label, colorVar, posClass, xinputFlag, config, clientRef, interactive }: FaceButtonProps): JSX.Element {
  const [pressed, setPressed] = useState(false);

  const press = useCallback(() => {
    if (!interactive) return;
    setPressed(true);
    hapticPulse(config.haptics);
    clientRef.current?.sendGamepadButton(xinputFlag, true);
  }, [clientRef, config.haptics, interactive, xinputFlag]);

  const release = useCallback(() => {
    setPressed(false);
    clientRef.current?.sendGamepadButton(xinputFlag, false);
  }, [clientRef, xinputFlag]);

  return (
    <button
      type="button"
      className={`tgp-face-btn ${posClass}${pressed ? " is-pressed" : ""}`}
      style={{ "--face-color": `var(${colorVar})` } as React.CSSProperties}
      onTouchStart={(e) => { e.preventDefault(); press(); }}
      onTouchEnd={(e) => { e.preventDefault(); release(); }}
      onTouchCancel={(e) => { e.preventDefault(); release(); }}
    >
      {label}
    </button>
  );
}

/* ── D-pad ───────────────────────────────────────────────────────── */

interface DpadProps {
  config: TouchControlsConfig;
  clientRef: React.RefObject<GfnWebRtcClient | null>;
  interactive: boolean;
}

function Dpad({ config, clientRef, interactive }: DpadProps): JSX.Element {
  const pressed = useRef(new Set<number>());
  const [activeDirs, setActiveDirs] = useState<Set<number>>(new Set());

  const press = useCallback((flag: number) => {
    if (pressed.current.has(flag)) return;
    pressed.current.add(flag);
    if (interactive) {
      hapticPulse(config.haptics, 0.7);
      clientRef.current?.sendGamepadButton(flag, true);
    }
    setActiveDirs(new Set(pressed.current));
  }, [clientRef, config.haptics, interactive]);

  const release = useCallback((flag: number) => {
    if (!pressed.current.has(flag)) return;
    pressed.current.delete(flag);
    clientRef.current?.sendGamepadButton(flag, false);
    setActiveDirs(new Set(pressed.current));
  }, [clientRef]);

  const releaseAll = useCallback(() => {
    for (const flag of pressed.current) {
      clientRef.current?.sendGamepadButton(flag, false);
    }
    pressed.current.clear();
    setActiveDirs(new Set());
  }, [clientRef]);

  const flagsFromPosition = useCallback((el: HTMLElement, cx: number, cy: number): number[] => {
    const rect = el.getBoundingClientRect();
    const x = (cx - rect.left) / rect.width - 0.5;
    const y = (cy - rect.top) / rect.height - 0.5;

    const flags: number[] = [];
    if (y < -0.14) flags.push(GAMEPAD_DPAD_UP);
    if (y > 0.14) flags.push(GAMEPAD_DPAD_DOWN);
    if (x < -0.14) flags.push(GAMEPAD_DPAD_LEFT);
    if (x > 0.14) flags.push(GAMEPAD_DPAD_RIGHT);
    return flags;
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!interactive) return;
    const target = e.currentTarget;
    for (const t of Array.from(e.changedTouches)) {
      for (const f of flagsFromPosition(target, t.clientX, t.clientY)) press(f);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!interactive) return;
    const target = e.currentTarget;
    const next = new Set<number>();
    for (const t of Array.from(e.touches)) {
      for (const f of flagsFromPosition(target, t.clientX, t.clientY)) next.add(f);
    }
    for (const f of Array.from(pressed.current)) {
      if (!next.has(f)) release(f);
    }
    for (const f of next) press(f);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.touches.length === 0) releaseAll();
  };

  // Release everything when the stream overlay unmounts / hides.
  useEffect(() => () => {
    for (const flag of pressed.current) clientRef.current?.sendGamepadButton(flag, false);
    pressed.current.clear();
  }, [clientRef]);

  const dirClass = (flag: number): string =>
    `tgp-dpad-arm tgp-dpad-${flag === GAMEPAD_DPAD_UP ? "up" : flag === GAMEPAD_DPAD_DOWN ? "down" : flag === GAMEPAD_DPAD_LEFT ? "left" : "right"}${activeDirs.has(flag) ? " is-active" : ""}`;

  return (
    <div
      className="tgp-dpad"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="tgp-dpad-cross">
        <div className={dirClass(GAMEPAD_DPAD_UP)} />
        <div className={dirClass(GAMEPAD_DPAD_LEFT)} />
        <div className="tgp-dpad-hub" />
        <div className={dirClass(GAMEPAD_DPAD_RIGHT)} />
        <div className={dirClass(GAMEPAD_DPAD_DOWN)} />
      </div>
    </div>
  );
}

/* ── Analog thumbstick ───────────────────────────────────────────── */

interface ThumbstickProps {
  label: string;
  side: "left" | "right";
  config: TouchControlsConfig;
  clientRef: React.RefObject<GfnWebRtcClient | null>;
  interactive: boolean;
}

function Thumbstick({ label, side, config, clientRef, interactive }: ThumbstickProps): JSX.Element {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const activeId = useRef<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const invertY = side === "left" ? config.invertLeftY : config.invertRightY;

  const travel = useCallback((el: HTMLElement): number => el.getBoundingClientRect().width * 0.32, []);

  const apply = useCallback((touch: React.Touch) => {
    const base = stickRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const radius = travel(base);
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }

    setOffset({ x: dx, y: dy });

    const rawX = clamp(dx / radius, -1, 1);
    const rawY = clamp(dy / radius, -1, 1);
    const shaped = shapeStickInput(rawX, invertY ? -rawY : rawY, config.deadzone, config.sensitivity);
    if (interactive) clientRef.current?.sendGamepadStick(side, shaped.x, shaped.y);
  }, [clientRef, config.deadzone, config.sensitivity, interactive, invertY, side, travel]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!interactive || activeId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeId.current = touch.identifier;
    hapticPulse(config.haptics, 0.6);
    apply(touch);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!interactive || activeId.current === null) return;
    let touch: React.Touch | undefined;
    for (const t of Array.from(e.touches)) {
      if (t.identifier === activeId.current) { touch = t; break; }
    }
    if (touch) apply(touch);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (activeId.current === null) return;
    let found = false;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === activeId.current) { found = true; break; }
    }
    if (!found) return;
    activeId.current = null;
    setOffset({ x: 0, y: 0 });
    clientRef.current?.sendGamepadStick(side, 0, 0);
  };

  return (
    <div
      ref={stickRef}
      className={`tgp-stick${activeId.current !== null ? " is-active" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <span className="tgp-stick-label">{label}</span>
      <div
        className="tgp-stick-knob"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      />
    </div>
  );
}

/* ── Bumpers ─────────────────────────────────────────────────────── */

interface BumperProps {
  label: string;
  xinputFlag: number;
  config: TouchControlsConfig;
  clientRef: React.RefObject<GfnWebRtcClient | null>;
  interactive: boolean;
}

function Bumper({ label, xinputFlag, config, clientRef, interactive }: BumperProps): JSX.Element {
  const [pressed, setPressed] = useState(false);

  const press = () => {
    if (!interactive) return;
    setPressed(true);
    hapticPulse(config.haptics, 0.8);
    clientRef.current?.sendGamepadButton(xinputFlag, true);
  };
  const release = () => {
    setPressed(false);
    clientRef.current?.sendGamepadButton(xinputFlag, false);
  };

  return (
    <button
      type="button"
      className={`tgp-bumper${pressed ? " is-pressed" : ""}`}
      onTouchStart={(e) => { e.preventDefault(); press(); }}
      onTouchEnd={(e) => { e.preventDefault(); release(); }}
      onTouchCancel={(e) => { e.preventDefault(); release(); }}
    >
      {label}
    </button>
  );
}

/* ── Triggers (tap for full pull, drag for analog) ───────────────── */

interface TriggerProps {
  label: string;
  side: "left" | "right";
  config: TouchControlsConfig;
  clientRef: React.RefObject<GfnWebRtcClient | null>;
  interactive: boolean;
}

function Trigger({ label, side, config, clientRef, interactive }: TriggerProps): JSX.Element {
  const [value, setValue] = useState(0);
  const startY = useRef<number | null>(null);
  const activeId = useRef<number | null>(null);
  const analog = config.triggerStyle === "analog";

  const commit = useCallback((v: number) => {
    const clamped = clamp(v, 0, 1);
    setValue(clamped);
    clientRef.current?.sendGamepadTrigger(side, clamped);
  }, [clientRef, side]);

  const handleStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!interactive || activeId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeId.current = touch.identifier;
    startY.current = touch.clientY;
    hapticPulse(config.haptics, 0.9);
    commit(1);
  };

  const handleMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!analog || activeId.current === null || startY.current === null) return;
    let touch: React.Touch | undefined;
    for (const t of Array.from(e.touches)) {
      if (t.identifier === activeId.current) { touch = t; break; }
    }
    if (!touch) return;
    // Pull down = release, up = full pull. 70px of travel covers the range.
    commit(1 - (touch.clientY - startY.current) / 70);
  };

  const handleEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (activeId.current === null) return;
    let found = false;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === activeId.current) { found = true; break; }
    }
    if (!found) return;
    activeId.current = null;
    startY.current = null;
    commit(0);
  };

  return (
    <button
      type="button"
      className={`tgp-trigger${value > 0 ? " is-pressed" : ""}`}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      aria-label={`${label} trigger`}
    >
      <span className="tgp-trigger-fill" style={{ opacity: 0.25 + value * 0.75 }} />
      <span className="tgp-trigger-label">{label}</span>
    </button>
  );
}

/* ── Small round buttons (Back / Guide / Start) ──────────────────── */

interface PillButtonProps {
  label: React.ReactNode;
  ariaLabel: string;
  xinputFlag: number;
  config: TouchControlsConfig;
  clientRef: React.RefObject<GfnWebRtcClient | null>;
  interactive: boolean;
}

function PillButton({ label, ariaLabel, xinputFlag, config, clientRef, interactive }: PillButtonProps): JSX.Element {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      className={`tgp-pill${pressed ? " is-pressed" : ""}`}
      aria-label={ariaLabel}
      onTouchStart={(e) => {
        e.preventDefault();
        if (!interactive) return;
        setPressed(true);
        hapticPulse(config.haptics, 0.7);
        clientRef.current?.sendGamepadButton(xinputFlag, true);
      }}
      onTouchEnd={(e) => { e.preventDefault(); setPressed(false); clientRef.current?.sendGamepadButton(xinputFlag, false); }}
      onTouchCancel={(e) => { e.preventDefault(); setPressed(false); clientRef.current?.sendGamepadButton(xinputFlag, false); }}
    >
      {label}
    </button>
  );
}

/* ── Tune panel (live customisation while playing) ──────────────── */

interface TunePanelProps {
  config: TouchControlsConfig;
  editing: boolean;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onToggleEditing: () => void;
  onResetLayout: () => void;
  onClose: () => void;
}

function TunePanel({
  config,
  editing,
  onChange,
  onToggleEditing,
  onResetLayout,
  onClose,
}: TunePanelProps): JSX.Element {
  return (
    <div className="tgp-tune" role="dialog" aria-label="Touch controls tuning">
      <div className="tgp-tune-head">
        <span className="tgp-tune-title">
          <SlidersHorizontal size={14} /> Touch controls
        </span>
        <button type="button" className="tgp-tune-close" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="tgp-tune-section">
        <span className="tgp-tune-label">Layout</span>
        <div className="tgp-tune-chips">
          {TOUCH_LAYOUTS.filter((l) => l.id !== "custom").map((layout) => (
            <button
              key={layout.id}
              type="button"
              className={`tgp-chip${config.layout === layout.id ? " is-active" : ""}`}
              onClick={() => onChange("touchLayout", layout.id)}
            >
              {layout.name}
            </button>
          ))}
        </div>
      </div>

      <div className="tgp-tune-section">
        <span className="tgp-tune-label">Theme</span>
        <div className="tgp-tune-swatches">
          {TOUCH_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              title={theme.name}
              aria-label={theme.name}
              className={`tgp-swatch${config.theme === theme.id ? " is-active" : ""}`}
              style={{ background: theme.vars.accent }}
              onClick={() => onChange("touchTheme", theme.id)}
            />
          ))}
        </div>
      </div>

      <div className="tgp-tune-section">
        <div className="tgp-tune-row">
          <span className="tgp-tune-label">Size</span>
          <span className="tgp-tune-value">{Math.round(config.scale * 100)}%</span>
        </div>
        <input
          type="range"
          className="tgp-range"
          min={60}
          max={160}
          step={5}
          value={Math.round(config.scale * 100)}
          onChange={(e) => onChange("touchScalePercent", parseInt(e.target.value, 10))}
        />
      </div>

      <div className="tgp-tune-section">
        <div className="tgp-tune-row">
          <span className="tgp-tune-label">Opacity</span>
          <span className="tgp-tune-value">{Math.round(config.opacity * 100)}%</span>
        </div>
        <input
          type="range"
          className="tgp-range"
          min={25}
          max={100}
          step={5}
          value={Math.round(config.opacity * 100)}
          onChange={(e) => onChange("touchOpacityPercent", parseInt(e.target.value, 10))}
        />
      </div>

      <div className="tgp-tune-actions">
        <button
          type="button"
          className={`tgp-tune-action${editing ? " is-active" : ""}`}
          onClick={onToggleEditing}
        >
          <Move size={13} />
          {editing ? "Done" : "Edit layout"}
        </button>
        <button type="button" className="tgp-tune-action" onClick={onResetLayout}>
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      <p className="tgp-tune-hint">
        {editing
          ? "Drag any control to move it. The layout switches to Custom automatically."
          : "Full list of options lives in Settings → Touch controls."}
      </p>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */

export function TouchGamepad({
  clientRef,
  visible,
  settings,
  onSettingChange,
  inline = false,
}: Props): JSX.Element | null {
  const config = useMemo(() => readTouchControls(settings), [settings]);
  const [editing, setEditing] = useState(false);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<TouchClusterId, TouchPoint>>>({});

  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    id: TouchClusterId;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    rect: DOMRect;
    current: TouchPoint;
  } | null>(null);

  const positioned = useMemo(() => resolvePositions(config), [config]);

  // Merge live drag offsets on top of the resolved positions.
  const effective = useMemo(() => {
    if (Object.keys(draft).length === 0) return positioned;
    const merged = { ...positioned };
    for (const id of Object.keys(draft) as TouchClusterId[]) {
      const point = draft[id];
      if (point) merged[id] = point;
    }
    return merged;
  }, [draft, positioned]);

  // Latest on-screen positions -- read from refs inside drag handlers so the
  // window listeners never go stale mid-gesture.
  const effectiveRef = useRef(positioned);
  effectiveRef.current = effective;

  const shown = useMemo(() => visibleClusters(config), [config]);
  const faceMap = useMemo(() => getFaceMap(config.faceStyle), [config.faceStyle]);
  const theme = getTheme(config.theme);
  const cssVars = useMemo(() => touchCssVars(config), [config]);

  const change = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    onSettingChange?.(key, value);
  }, [onSettingChange]);

  const beginDrag = useCallback((id: TouchClusterId, clientX: number, clientY: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const origin = effectiveRef.current[id];
    dragRef.current = {
      id,
      startX: clientX,
      startY: clientY,
      originX: origin.x,
      originY: origin.y,
      rect,
      current: origin,
    };
    hapticPulse(config.haptics, 0.6);
  }, [config.haptics]);

  // Global drag listeners -- the finger may leave the cluster while moving.
  useEffect(() => {
    if (!editing) return;

    const move = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const x = clamp(drag.originX + ((touch.clientX - drag.startX) / drag.rect.width) * 100, 2, 98);
      const y = clamp(drag.originY + ((touch.clientY - drag.startY) / drag.rect.height) * 100, 2, 98);
      drag.current = { x, y };
      setDraft((prev) => ({ ...prev, [drag.id]: { x, y } }));
    };

    const end = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      // Persist the whole arrangement so switching to "custom" keeps it intact.
      const finalPositions = { ...effectiveRef.current };
      change("touchCustomPositions", serializePositions(finalPositions));
      change("touchLayout", "custom");
      setDraft({});
    };

    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [change, editing]);

  const resetLayout = useCallback(() => {
    change("touchCustomPositions", "");
    change("touchLayout", "classic");
    setDraft({});
  }, [change]);

  if (!visible) return null;

  const interactive = !editing;

  const rootClass = `tgp${inline ? " tgp--inline" : ""}${editing ? " tgp--editing" : ""}`;

  return (
    <div
      ref={rootRef}
      className={rootClass}
      style={cssVars as React.CSSProperties}
      data-theme={theme.id}
    >
      {/* Left bumpers + trigger */}
      {shown.shouldersLeft && (
        <Cluster
          id="shouldersLeft"
          position={effective.shouldersLeft}
          editing={editing}
          className="tgp-cluster--shoulders tgp-cluster--shoulders-left"
          onDragStart={beginDrag}
        >
          <Trigger label="LT" side="left" config={config} clientRef={clientRef} interactive={interactive} />
          <Bumper label="LB" xinputFlag={GAMEPAD_LB} config={config} clientRef={clientRef} interactive={interactive} />
        </Cluster>
      )}

      {/* Right bumpers + trigger */}
      {shown.shouldersRight && (
        <Cluster
          id="shouldersRight"
          position={effective.shouldersRight}
          editing={editing}
          className="tgp-cluster--shoulders tgp-cluster--shoulders-right"
          onDragStart={beginDrag}
        >
          <Bumper label="RB" xinputFlag={GAMEPAD_RB} config={config} clientRef={clientRef} interactive={interactive} />
          <Trigger label="RT" side="right" config={config} clientRef={clientRef} interactive={interactive} />
        </Cluster>
      )}

      {/* D-pad */}
      {shown.dpad && (
        <Cluster id="dpad" position={effective.dpad} editing={editing} onDragStart={beginDrag}>
          <Dpad config={config} clientRef={clientRef} interactive={interactive} />
        </Cluster>
      )}

      {/* Left stick */}
      {shown.leftStick && (
        <Cluster id="leftStick" position={effective.leftStick} editing={editing} onDragStart={beginDrag}>
          <Thumbstick
            label="L"
            side={config.swapSticks ? "right" : "left"}
            config={config}
            clientRef={clientRef}
            interactive={interactive}
          />
        </Cluster>
      )}

      {/* Right stick */}
      {shown.rightStick && (
        <Cluster id="rightStick" position={effective.rightStick} editing={editing} onDragStart={beginDrag}>
          <Thumbstick
            label="R"
            side={config.swapSticks ? "left" : "right"}
            config={config}
            clientRef={clientRef}
            interactive={interactive}
          />
        </Cluster>
      )}

      {/* Face buttons */}
      {shown.face && (
        <Cluster id="face" position={effective.face} editing={editing} onDragStart={beginDrag}>
          <div className="tgp-face">
            <FaceButton
              label={faceMap.top.label}
              posClass="tgp-face-pos-top"
              colorVar={faceColorVar(faceMap.top)}
              xinputFlag={faceMap.top.flag}
              config={config}
              clientRef={clientRef}
              interactive={interactive}
            />
            <div className="tgp-face-row">
              <FaceButton
                label={faceMap.left.label}
                posClass="tgp-face-pos-left"
                colorVar={faceColorVar(faceMap.left)}
                xinputFlag={faceMap.left.flag}
                config={config}
                clientRef={clientRef}
                interactive={interactive}
              />
              <FaceButton
                label={faceMap.right.label}
                posClass="tgp-face-pos-right"
                colorVar={faceColorVar(faceMap.right)}
                xinputFlag={faceMap.right.flag}
                config={config}
                clientRef={clientRef}
                interactive={interactive}
              />
            </div>
            <FaceButton
              label={faceMap.bottom.label}
              posClass="tgp-face-pos-bottom"
              colorVar={faceColorVar(faceMap.bottom)}
              xinputFlag={faceMap.bottom.flag}
              config={config}
              clientRef={clientRef}
              interactive={interactive}
            />
          </div>
        </Cluster>
      )}

      {/* Back / Guide / Start */}
      {shown.centre && (
        <Cluster id="centre" position={effective.centre} editing={editing} onDragStart={beginDrag}>
          <div className="tgp-centre-cluster">
            <PillButton
              label={<span className="tgp-glyph">&#9776;</span>}
              ariaLabel="Back"
              xinputFlag={GAMEPAD_BACK}
              config={config}
              clientRef={clientRef}
              interactive={interactive}
            />
            <PillButton
              label={<span className="tgp-glyph">&#9678;</span>}
              ariaLabel="Guide"
              xinputFlag={GAMEPAD_GUIDE}
              config={config}
              clientRef={clientRef}
              interactive={interactive}
            />
            <PillButton
              label={<span className="tgp-glyph">&#9654;</span>}
              ariaLabel="Start"
              xinputFlag={GAMEPAD_START}
              config={config}
              clientRef={clientRef}
              interactive={interactive}
            />
          </div>
        </Cluster>
      )}

      {/* Floating tune button + panel */}
      {!inline && config.showTuneButton && !editing && (
        <button
          type="button"
          className="tgp-tune-btn"
          aria-label="Tune touch controls"
          onClick={() => setTuneOpen((open) => !open)}
        >
          <SlidersHorizontal size={15} />
        </button>
      )}

      {!inline && tuneOpen && (
        <TunePanel
          config={config}
          editing={editing}
          onChange={change}
          onToggleEditing={() => {
            setEditing((prev) => !prev);
            setTuneOpen(false);
          }}
          onResetLayout={resetLayout}
          onClose={() => setTuneOpen(false)}
        />
      )}

      {!inline && editing && (
        <div className="tgp-edit-bar">
          <span className="tgp-edit-hint">
            <Move size={13} /> Drag controls to reposition
          </span>
          <button
            type="button"
            className="tgp-edit-done"
            onClick={() => {
              setEditing(false);
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export const TOUCH_CONTROLS_DEFAULTS = DEFAULT_TOUCH_CONTROLS;
