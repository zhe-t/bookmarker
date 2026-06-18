import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import { useClickAway } from "../ui/hooks.js";

// Right-click menu, clamped to the viewport. Measured invisibly on first
// paint, then positioned. Dismissed by click-away, scroll, or resize;
// Escape is handled by App's layered handler.
export function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8)),
    });
  }, [x, y]);

  useClickAway(ref, onClose);
  useEffect(() => {
    // page scrolls dismiss the menu; scrolling inside the menu must not
    const h = (e) => { if (!ref.current || !ref.current.contains(e.target)) onClose(); };
    window.addEventListener("scroll", h, true);
    window.addEventListener("resize", h);
    return () => { window.removeEventListener("scroll", h, true); window.removeEventListener("resize", h); };
  }, [onClose]);

  // single-letter shortcuts for items that declare a `key`. Capture phase so
  // it resolves before App's layered Escape/key handler.
  useEffect(() => {
    const h = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const it = items.find((i) => i && i.key && i.key.toLowerCase() === e.key.toLowerCase());
      if (it) { e.preventDefault(); e.stopPropagation(); onClose(); it.run(); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [items, onClose]);

  return (
    <div ref={ref} className="ctx-menu scroll" role="menu"
      style={pos ? { left: pos.left, top: pos.top } : { left: x, top: y, visibility: "hidden" }}>
      {items.map((it, i) => it === "sep" ? (
        <div key={i} className="ctx-sep" />
      ) : it.header ? (
        <div key={i} className="ctx-header">{it.header}</div>
      ) : (
        <button key={i} role="menuitem" className={`popover-item${it.danger ? " ctx-item--danger" : ""}`}
          onClick={() => { onClose(); it.run(); }}>
          {it.icon} {it.label}
          {it.key && <span className="kbd ctx-kbd">{it.key}</span>}
        </button>
      ))}
    </div>
  );
}
