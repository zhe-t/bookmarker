import React, { useState, useRef, useEffect, useMemo } from "react";
import * as Ic from "../ui/icons.jsx";
import { useClickAway } from "../ui/hooks.js";

const normalizeUrl = (raw) => {
  const v = raw.trim();
  if (!v) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : "https://" + v;
  try { const u = new URL(candidate); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
};

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

// Guided add/edit form. App renders it inside .overlay/.modal and owns
// Escape handling; this component owns validation and field focus.
export function BookmarkModal({ mode, initial = {}, focus = "url", folders = [], allTags = [], existingUrls, onSave, onClose }) {
  const [title, setTitle] = useState(initial.title || "");
  const [url, setUrl] = useState(initial.url || "");
  const [folder, setFolder] = useState(initial.folder || "");
  const [tags, setTags] = useState((initial.tags || []).join(", "));
  const [note, setNote] = useState(initial.note || "");
  const [saving, setSaving] = useState(false);
  const [folderListOpen, setFolderListOpen] = useState(false);
  const [tagListOpen, setTagListOpen] = useState(false);
  const titleRef = useRef(null); const urlRef = useRef(null);
  const folderRef = useRef(null); const tagRef = useRef(null);

  useEffect(() => { (focus === "title" ? titleRef : urlRef).current?.focus(); }, [focus]);
  useClickAway(folderRef, () => setFolderListOpen(false), folderListOpen);
  useClickAway(tagRef, () => setTagListOpen(false), tagListOpen);

  // clipboard-aware quick add: prefill the URL if the clipboard holds one
  useEffect(() => {
    if (mode !== "add" || initial.url) return;
    navigator.clipboard?.readText?.().then((t) => {
      const n = normalizeUrl((t || "").trim());
      if (n) setUrl((cur) => cur || (t.trim()));
    }).catch(() => { /* clipboard blocked */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pasteUrl = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setUrl(t.trim()); } catch { /* clipboard blocked */ }
    urlRef.current?.focus();
  };

  const folderMatches = useMemo(() => {
    const q = folder.trim().toLowerCase();
    return (q ? folders.filter((f) => f.toLowerCase().includes(q)) : folders).slice(0, 8);
  }, [folder, folders]);

  const lastTagToken = (tags.split(/,/).pop() || "").trim().toLowerCase();
  const tagMatches = useMemo(() => {
    const chosen = new Set(tags.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean));
    return allTags.filter((t) => !chosen.has(t) && (lastTagToken ? t.includes(lastTagToken) : true)).slice(0, 8);
  }, [tags, allTags, lastTagToken]);
  const addTagToken = (t) => {
    const parts = tags.split(/,/);
    parts[parts.length - 1] = " " + t;
    setTags(parts.join(",").replace(/^[,\s]+/, "") + ", ");
    tagRef.current?.focus();
  };

  const normalized = useMemo(() => normalizeUrl(url), [url]);
  const urlInvalid = url.trim() !== "" && !normalized;
  const isDupe = mode === "add" && normalized && existingUrls?.has(normalized);
  const folderName = folder.trim();
  const canSave = !!normalized && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim() || hostOf(normalized) || normalized,
        url: normalized,
        folderName: folderName || null,
        tags: [...new Set(tags.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))],
        note: note.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-title">{mode === "add" ? "Add bookmark" : "Edit bookmark"}</div>

      <label className="field">
        <span className="field-label">URL</span>
        <div className="input-row">
          <input ref={urlRef} className="text-input field-input" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com" spellCheck={false} />
          <button type="button" className="input-btn" onClick={pasteUrl} aria-label="Paste from clipboard" title="Paste"><Ic.Clipboard size={14} /></button>
          <button type="button" className="input-btn" onClick={() => { setUrl(""); urlRef.current?.focus(); }} disabled={!url} aria-label="Clear URL" title="Clear"><Ic.X size={14} /></button>
        </div>
        {urlInvalid && <span className="field-err">Enter a valid web address</span>}
        {isDupe && <span className="field-hint">Already bookmarked. Saving adds a duplicate.</span>}
      </label>

      <label className="field">
        <span className="field-label">Title</span>
        <input ref={titleRef} className="text-input field-input" value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (!title.trim() && normalized) setTitle(hostOf(normalized)); }}
          placeholder="Page title" />
      </label>

      <div className="field">
        <span className="field-label">Folder <em>pick one or type a new category</em></span>
        <div className="combo" ref={folderRef}>
          <div className="input-row">
            <input className="text-input field-input" value={folder}
              onChange={(e) => { setFolder(e.target.value); setFolderListOpen(true); }}
              onFocus={() => setFolderListOpen(true)} placeholder="Bookmarks bar" />
            <button type="button" className="input-btn" onClick={() => setFolderListOpen((o) => !o)}
              aria-label="Toggle folder list" tabIndex={-1}><Ic.ChevronD size={14} /></button>
          </div>
          {folderListOpen && folderMatches.length > 0 && (
            <div className="combo-list scroll">
              {folderMatches.map((f) => (
                <button type="button" key={f} className={`combo-item${f === folderName ? " on" : ""}`}
                  onClick={() => { setFolder(f); setFolderListOpen(false); }}>
                  <Ic.Folder size={13} /> {f}
                </button>
              ))}
            </div>
          )}
        </div>
        {folderName && !folders.includes(folderName) && (
          <span className="field-hint" style={{ color: "var(--accent)" }}>New folder "{folderName}" will be created</span>
        )}
      </div>

      {mode === "add" && (
        <div className="field">
          <span className="field-label">Tags <em>optional</em></span>
          <div className="combo" ref={tagRef}>
            <input className="text-input field-input" value={tags}
              onChange={(e) => { setTags(e.target.value); setTagListOpen(true); }}
              onFocus={() => setTagListOpen(true)} placeholder="ai, reading" />
            {tagListOpen && tagMatches.length > 0 && (
              <div className="combo-list scroll">
                {tagMatches.map((t) => (
                  <button type="button" key={t} className="combo-item" onClick={() => addTagToken(t)}>
                    <Ic.Tag size={13} /> {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <label className="field">
        <span className="field-label">Note <em>optional · searchable</em></span>
        <textarea className="text-input field-input feedback-area" value={note} rows={2}
          onChange={(e) => setNote(e.target.value)} placeholder="why you saved this…" />
      </label>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={!canSave}>
          {saving ? "Saving…" : mode === "add" ? "Add bookmark" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
