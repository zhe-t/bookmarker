import React, { useState, useMemo, useEffect, useRef } from "react";
import { fuzzy, ago } from "../lib/model.js";
import { Favicon } from "../ui/Favicon.jsx";
import * as Ic from "../ui/icons.jsx";

// Command palette used by both the popup and the in-page (newtab) overlay.
// `actions` is a list of { label, hint, run }. Bookmarks come from `live`.
export function Palette({ live, actions, onOpenBookmark, autoFocus = true, maxHeight = 380 }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const acts = useMemo(() => (q ? actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase())) : actions), [q, actions]);
  const bms = useMemo(
    () => (q ? live.map((b) => { const m = fuzzy(q, b.title + " " + b.domain); return m ? { b, s: m.score } : null; }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 8) : []),
    [q, live]
  );
  const flat = [...acts.map((a) => ({ type: "a", a })), ...bms.map((x) => ({ type: "b", b: x.b }))];
  useEffect(() => { setI(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    else if (e.key === "Enter") { const it = flat[i]; if (it?.type === "a") it.a.run(); else if (it?.type === "b") onOpenBookmark(it.b); }
  };

  return (
    <div>
      <div className="pal-head">
        <Ic.Command size={15} />
        <input ref={ref} className="pal-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Run an action or jump to a bookmark…" aria-label="Command palette" />
        <span className="kbd">esc</span>
      </div>
      <div className="pal-list scroll" style={{ maxHeight }} role="listbox">
        {acts.length > 0 && <div className="pal-section">Actions</div>}
        {flat.map((it, idx) => it.type === "a" ? (
          <div key={"a" + idx} role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)}
            onClick={() => it.a.run()} className={`pal-row${idx === i ? " on" : ""}`}>
            <Ic.Arrow size={13} />
            <span className="pal-label">{it.a.label}</span>
            {it.a.hint && <span className="kbd">{it.a.hint}</span>}
          </div>
        ) : (
          <React.Fragment key={"b" + idx}>
            {idx === acts.length && <div className="pal-section">Bookmarks</div>}
            <div role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)}
              onClick={() => onOpenBookmark(it.b)} className={`pal-row${idx === i ? " on" : ""}`}>
              <Favicon b={it.b} size={24} />
              <span className="pal-label">{it.b.title}</span>
              <span className="pal-hint">{ago(it.b.lastVisited)}</span>
            </div>
          </React.Fragment>
        ))}
        {flat.length === 0 && (
          <div className="empty" style={{ padding: "34px 20px" }}>
            <div className="empty-glyph"><Ic.Circle size={28} /></div>
            <div className="empty-sub">no matches</div>
          </div>
        )}
      </div>
    </div>
  );
}
