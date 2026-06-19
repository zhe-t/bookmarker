import React, { useState, useMemo, useEffect, useRef } from "react";
import { fuzzy, ago } from "../lib/model.js";
import { Favicon } from "../ui/Favicon.jsx";
import * as Ic from "../ui/icons.jsx";

// Command palette used by both the popup and the in-page (newtab) overlay.
// `actions` is a list of { label, hint, run }. Bookmarks come from `live`.
//
// Optional enrichments (used by the popup so it matches the dashboard):
//   pinned        — bookmarks to surface while the query is empty
//   suggestions   — "add this" candidates to surface while the query is empty
//   onAddSuggestion(s) — invoked when a suggestion row is chosen
//   theme / onToggleTheme — render the light/dark toggle in the header
export function Palette({
  live,
  actions,
  onOpenBookmark,
  onAddSuggestion,
  pinned = [],
  suggestions = [],
  theme,
  onToggleTheme,
  autoFocus = true,
  maxHeight = 380,
}) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const acts = useMemo(() => (q ? actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase())) : actions), [q, actions]);
  const bms = useMemo(
    () => (q ? live.map((b) => { const m = fuzzy(q, b.title + " " + b.domain); return m ? { b, s: m.score } : null; }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 8) : []),
    [q, live]
  );

  // While idle (no query) surface pins + suggestions, like the dashboard does.
  const idlePins = q ? [] : pinned.slice(0, 8);
  const idleSugg = q ? [] : suggestions.slice(0, 6);

  // Idle view leads with the user's own stuff (pinned, then suggested), with
  // actions below; a query collapses to actions + fuzzy bookmark matches.
  const flat = [
    ...idlePins.map((b) => ({ type: "b", b })),
    ...idleSugg.map((s) => ({ type: "s", s })),
    ...acts.map((a) => ({ type: "a", a })),
    ...bms.map((x) => ({ type: "b", b: x.b })),
  ];
  useEffect(() => { setI(0); }, [q]);

  // section boundaries (pins/sugg are empty while querying; bms empty while idle)
  const pinsEnd = idlePins.length;
  const suggEnd = pinsEnd + idleSugg.length;
  const actsEnd = suggEnd + acts.length;
  const sectionFor = (idx) => {
    if (idx === 0 && idlePins.length) return "Pinned";
    if (idx === pinsEnd && idleSugg.length) return "Suggested";
    if (idx === suggEnd && acts.length) return "Actions";
    if (idx === actsEnd && bms.length) return "Bookmarks";
    return null;
  };

  const runRow = (it) => {
    if (it.type === "a") it.a.run();
    else if (it.type === "b") onOpenBookmark(it.b);
    else if (it.type === "s") onAddSuggestion?.(it.s);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    else if (e.key === "Enter") { const it = flat[i]; if (it) runRow(it); }
  };

  return (
    <div>
      <div className="pal-head">
        <Ic.Command size={15} />
        <input ref={ref} className="pal-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Run an action or jump to a bookmark…" aria-label="Command palette" />
        {onToggleTheme && (
          <span className="pal-theme" title="Toggle light / dark">
            <Ic.Sun size={13} />
            <button type="button" role="switch" aria-checked={theme === "dark"} aria-label="Toggle theme"
              className={`set-toggle${theme === "dark" ? " on" : ""}`}
              onMouseDown={(e) => e.preventDefault()} onClick={onToggleTheme}>
              <span className="set-knob" />
            </button>
            <Ic.Moon size={13} />
          </span>
        )}
        <span className="kbd">esc</span>
      </div>
      <div className="pal-list scroll" style={{ maxHeight }} role="listbox">
        {flat.map((it, idx) => {
          const sec = sectionFor(idx);
          const row = it.type === "a" ? (
            <div role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)}
              onClick={() => it.a.run()} className={`pal-row${idx === i ? " on" : ""}`}>
              <Ic.Arrow size={13} />
              <span className="pal-label">{it.a.label}</span>
              {it.a.hint && <span className="kbd">{it.a.hint}</span>}
            </div>
          ) : it.type === "s" ? (
            <div role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)}
              onClick={() => onAddSuggestion?.(it.s)} className={`pal-row${idx === i ? " on" : ""}`}>
              <Favicon b={it.s} size={24} />
              <span className="pal-label">{it.s.title || it.s.domain}</span>
              <span className="pal-hint">{it.s.domain}</span>
              <Ic.Plus size={12} />
            </div>
          ) : (
            <div role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)}
              onClick={() => onOpenBookmark(it.b)} className={`pal-row${idx === i ? " on" : ""}`}>
              <Favicon b={it.b} size={24} />
              <span className="pal-label">{it.b.title}</span>
              <span className="pal-hint">{it.b.pinned && !q ? "pinned" : ago(it.b.lastVisited)}</span>
            </div>
          );
          return (
            <React.Fragment key={it.type + idx}>
              {sec && <div className="pal-section">{sec}</div>}
              {row}
            </React.Fragment>
          );
        })}
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
