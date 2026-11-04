import type { JSX } from "react";

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}): JSX.Element {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="mini-slider">
      <div className="mini-slider__head">
        <span>{label}</span>
        <b>{format(value)}</b>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ["--fill" as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
