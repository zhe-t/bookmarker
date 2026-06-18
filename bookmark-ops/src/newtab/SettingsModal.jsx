import React, { useRef } from "react";
import * as Ic from "../ui/icons.jsx";

// Small segmented control reused for each setting row.
function Seg({ value, onChange, options }) {
  return (
    <div className="set-seg">
      {options.map(([k, label]) => (
        <button type="button" key={k} className={`set-seg-btn${value === k ? " on" : ""}`} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button type="button" className={`set-toggle${on ? " on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="set-knob" />
    </button>
  );
}

const Row = ({ label, hint, children }) => (
  <div className="set-row">
    <div className="set-row-text">
      <span className="set-row-label">{label}</span>
      {hint && <span className="set-row-hint">{hint}</span>}
    </div>
    {children}
  </div>
);

// Consolidated preferences. All values are owned by App and persisted there.
export function SettingsModal({
  theme, setTheme, pinLayout, setPinLayout, sort, setSort, scope, setScope,
  showSugg, setShowSugg, showPinned, setShowPinned, showLater, setShowLater,
  showUrls, setShowUrls, density, setDensity, accent, setAccent, accents, syncOn, onToggleSync,
  onExportJson, onImportJson, onShowTour, scopes, onClose,
}) {
  const fileRef = useRef(null);

  return (
    <div className="form">
      <div className="form-title"><Ic.Sliders size={17} /> Settings</div>

      <div className="set-scroll scroll">
        <Row label="Theme">
          <Seg value={theme} onChange={setTheme} options={[["dark", "Dark"], ["light", "Light"], ["auto", "Auto"]]} />
        </Row>
        <Row label="Accent">
          <div className="set-swatches">
            {accents.map((a) => (
              <button type="button" key={a.name} title={a.name} aria-label={a.name}
                className={`set-swatch${accent === a.name ? " on" : ""}`}
                style={{ background: a.accent }} onClick={() => setAccent(a.name)} />
            ))}
          </div>
        </Row>
        <Row label="Row density" hint="how tight the lists pack">
          <Seg value={density} onChange={setDensity} options={[["comfortable", "Cozy"], ["compact", "Compact"]]} />
        </Row>
        <Row label="Show URLs" hint="show the domain & folder under each title">
          <Toggle on={showUrls} onChange={setShowUrls} />
        </Row>
        <Row label="Pinned layout">
          <Seg value={pinLayout} onChange={setPinLayout} options={[["scroll", "Scroll"], ["grid", "Grid"], ["compact", "Compact"]]} />
        </Row>
        <Row label="Default sort">
          <Seg value={sort} onChange={setSort} options={[["best", "Best"], ["folder", "Folder"], ["added", "New"], ["alpha", "A–Z"]]} />
        </Row>
        <Row label="Default view">
          <Seg value={scope} onChange={setScope} options={scopes.map(([k, l]) => [k, l])} />
        </Row>

        <div className="set-divider" />

        <Row label="Show suggested" hint="frequently-visited pages you haven't saved">
          <Toggle on={showSugg} onChange={setShowSugg} />
        </Row>
        <Row label="Show pinned" hint="pinned bookmarks on the home view">
          <Toggle on={showPinned} onChange={setShowPinned} />
        </Row>
        <Row label="Show read later" hint="read-later queue on the home view">
          <Toggle on={showLater} onChange={setShowLater} />
        </Row>

        <div className="set-divider" />

        <Row label="Sync across devices" hint="mirror tags, pins & notes via your browser account">
          <Toggle on={syncOn} onChange={onToggleSync} />
        </Row>
        <Row label="Backup" hint="export or restore everything as JSON (incl. tags & notes)">
          <div className="set-btns">
            <button type="button" className="btn" onClick={onExportJson}><Ic.Export size={13} /> Export</button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Ic.Import size={13} /> Import</button>
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportJson(f); e.target.value = ""; }} />
          </div>
        </Row>
        <Row label="Onboarding" hint="replay the welcome walkthrough">
          <button type="button" className="btn" onClick={onShowTour}><Ic.Question size={13} /> Show tour</button>
        </Row>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
