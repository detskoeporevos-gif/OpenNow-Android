import type { JSX } from "react";
import { useStore } from "../state/store";

export function Toasts(): JSX.Element | null {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
