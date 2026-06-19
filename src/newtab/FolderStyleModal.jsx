import React, { useState } from "react";

const COLORS = ["#c8f24f", "#6db1ff", "#ff7369", "#ffc24b", "#43d98b", "#b888ff", "#ff9ecb", "#79818d"];

// Set an emoji and/or color for a folder. Writes meta.folderStyles[path].
export function FolderStyleModal({ folderName, initial = {}, onSave, onClose }) {
  const [emoji, setEmoji] = useState(initial.emoji || "");
  const [color, setColor] = useState(initial.color || "");

  return (
    <div className="form">
      <div className="form-title">Customize “{folderName}”</div>

      <label className="field">
        <span className="field-label">Emoji <em>one character</em></span>
        <input className="text-input field-input" value={emoji} maxLength={4}
          onChange={(e) => setEmoji([...e.target.value].slice(0, 1).join(""))} placeholder="📁" />
      </label>

      <div className="field">
        <span className="field-label">Color</span>
        <div className="set-swatches">
          <button type="button" className={`set-swatch set-swatch--none${!color ? " on" : ""}`} title="None" onClick={() => setColor("")} />
          {COLORS.map((c) => (
            <button type="button" key={c} className={`set-swatch${color === c ? " on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn--primary" onClick={() => { onSave({ emoji, color }); onClose(); }}>Save</button>
      </div>
    </div>
  );
}
