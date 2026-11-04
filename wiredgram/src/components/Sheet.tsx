import type { JSX, ReactNode } from "react";
import { useEffect } from "react";
import { Icon } from "./Icon";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grab" />
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 className="sheet__title">{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
