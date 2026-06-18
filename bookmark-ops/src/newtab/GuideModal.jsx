import React, { useState } from "react";
import * as Ic from "../ui/icons.jsx";

// Short walkthroughs shown before the import / export actions run, so the user
// knows exactly what's about to happen before a file picker or download appears.
const GUIDES = {
  import: {
    icon: Ic.Import,
    title: "Import bookmarks",
    sub: "Bring in a bookmarks file from any browser.",
    steps: [
      ["Export from your old browser", "In Chrome, Edge, Firefox or Safari open the bookmark manager and choose “Export bookmarks”. You'll get a single .html file."],
      ["Pick that file here", "On the next screen, select the .html file. Nothing uploads — it's read locally in your browser."],
      ["We tidy as we go", "New links land in a folder called “Imported”, and anything you already have is skipped automatically — no duplicates."],
    ],
    cta: "Choose file",
    ctaIcon: Ic.Import,
  },
  export: {
    icon: Ic.Export,
    title: "Export bookmarks",
    sub: "Save a portable copy of every live bookmark.",
    steps: [
      ["Standard .html file", "We write a Netscape bookmark file — the same format every major browser reads. Trashed and archived items are left out."],
      ["Tags travel with it", "Your tags are saved alongside each link, so you won't lose them if you re-import later."],
      ["Download & keep it safe", "The file downloads to your computer. Use it as a backup or to move into another browser."],
    ],
    cta: "Download .html",
    ctaIcon: Ic.Export,
  },
};

export function GuideModal({ kind, onConfirm, onClose }) {
  const g = GUIDES[kind];
  const [step, setStep] = useState(0);
  const last = step === g.steps.length - 1;
  const Head = g.icon;
  const Cta = g.ctaIcon;

  return (
    <div className="guide">
      <div className="guide-head">
        <span className="guide-badge"><Head size={16} /></span>
        <div>
          <div className="form-title">{g.title}</div>
          <div className="guide-sub">{g.sub}</div>
        </div>
        <button className="btn btn--bare guide-x" onClick={onClose} aria-label="Close"><Ic.X size={14} /></button>
      </div>

      <ol className="guide-steps">
        {g.steps.map(([t, d], i) => (
          <li key={i} className={`guide-step${i === step ? " on" : ""}${i < step ? " done" : ""}`}
            onClick={() => setStep(i)}>
            <span className="guide-step-num">{i < step ? <Ic.Check size={12} /> : i + 1}</span>
            <div>
              <div className="guide-step-title">{t}</div>
              {i === step && <div className="guide-step-desc">{d}</div>}
            </div>
          </li>
        ))}
      </ol>

      <div className="guide-dots">
        {g.steps.map((_, i) => <span key={i} className={`guide-dot${i === step ? " on" : ""}`} />)}
      </div>

      <div className="form-actions">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        {!last ? (
          <button className="btn btn--primary" onClick={() => setStep(step + 1)}>Next</button>
        ) : (
          <button className="btn btn--primary" onClick={onConfirm}><Cta size={13} /> {g.cta}</button>
        )}
      </div>
    </div>
  );
}
