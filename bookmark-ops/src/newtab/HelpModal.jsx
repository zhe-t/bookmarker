import React from "react";

const KEYS = [
  ["⌘K", "Open the command palette"],
  ["⌘⇧K", "Open the palette from any page (toolbar popup)"],
  ["⌘1", "Switch to search"],
  ["⌘2", "Switch to cleanup"],
  ["⌘⇧B", "Open this dashboard from any page"],
  ["⇧ click", "Select a range of bookmarks"],
  ["esc", "Close the top dialog, then clear selection"],
];

const OPS = [
  ["is:dead", "Only unreachable links"],
  ["is:dupe", "Only duplicate URLs"],
  ["is:stale", "Unopened, or not visited in over a year"],
  ["is:untagged", "Bookmarks without tags"],
  ["tag:x", "Filter by tag"],
  ["site:x", "Filter by domain"],
  ["folder:x", "Filter by folder or category (also in:x)"],
  [">N visits", "Visited at least N times"],
];

export function HelpModal({ onClose }) {
  return (
    <div className="help">
      <div className="form-title" style={{ padding: "20px 20px 0" }}>Shortcuts</div>
      <div className="help-section">Keyboard</div>
      <div className="help-grid">
        {KEYS.map(([k, d]) => <React.Fragment key={k}><span className="kbd">{k}</span><span className="help-desc">{d}</span></React.Fragment>)}
      </div>
      <div className="help-section">Search operators</div>
      <div className="help-grid">
        {OPS.map(([k, d]) => <React.Fragment key={k}><span className="kbd">{k}</span><span className="help-desc">{d}</span></React.Fragment>)}
      </div>
      <div className="form-actions" style={{ padding: "0 20px 20px" }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
