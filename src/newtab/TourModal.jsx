import React, { useState, useEffect } from "react";
import * as Ic from "../ui/icons.jsx";

const STEPS = [
  {
    badge: <Ic.Logo size={30} />,
    title: "Welcome to bookmark.ops",
    body: "A keyboard-first home for your bookmarks — search, organize, and tidy them in seconds.",
    demo: null,
  },
  {
    badge: <Ic.Search size={26} />,
    title: "Find anything fast",
    body: "Fuzzy search runs across titles, domains, tags and notes. Narrow it with operators:",
    demo: <div className="tour-chips">{["is:dead", "site:github.com", "tag:reading", ">5 visits"].map((c) => <span key={c} className="tour-chip">{c}</span>)}</div>,
  },
  {
    badge: <Ic.Command size={26} />,
    title: "Built for the keyboard",
    body: "Press ⌘K for the command palette. In results, ↓ then j / k to move, Enter to open, p to pin.",
    demo: (
      <div className="tour-keys">
        <span className="kbd">⌘K</span><span className="kbd">/</span><span className="kbd">↓</span><span className="kbd">j</span><span className="kbd">k</span><span className="kbd">↵</span><span className="kbd">p</span>
      </div>
    ),
  },
  {
    badge: <Ic.Folder size={26} />,
    title: "Organize & tidy up",
    body: "Drag results into folders, pin or save for later, then clear out dead links and duplicates from Cleanup.",
    demo: (
      <div className="tour-iconrow">
        <span className="tour-ic"><Ic.Pin size={16} /></span>
        <span className="tour-ic"><Ic.Clock size={16} /></span>
        <span className="tour-ic"><Ic.Folder size={16} /></span>
        <span className="tour-ic"><Ic.Scan size={16} /></span>
      </div>
    ),
  },
];

// Stepped first-run onboarding (also reachable from the ⋯ menu / palette).
export function TourModal({ onClose }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const next = () => (last ? onClose() : setI((x) => x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));

  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const s = STEPS[i];
  return (
    <div className="tour">
      <div className="tour-dots">
        {STEPS.map((_, n) => <button key={n} className={`tour-dot${n === i ? " on" : ""}`} aria-label={`Step ${n + 1}`} onClick={() => setI(n)} />)}
      </div>

      <div className="tour-stage" key={i}>
        <div className="tour-badge">{s.badge}</div>
        <div className="tour-h">{s.title}</div>
        <p className="tour-p">{s.body}</p>
        {s.demo}
      </div>

      <div className="tour-foot">
        <button className="tour-skip" onClick={onClose}>Skip</button>
        <span style={{ flex: 1 }} />
        {i > 0 && <button className="btn" onClick={back}>Back</button>}
        <button className="btn btn--primary" onClick={next}>{last ? "Get started" : "Next"}</button>
      </div>
    </div>
  );
}
