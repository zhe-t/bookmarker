import React, { useMemo } from "react";
import * as Ic from "../ui/icons.jsx";
import { ago } from "../lib/model.js";

// Read-only insight panel computed from the live set + metadata.
export function StatsModal({ live, onOpen, onClose }) {
  const stats = useMemo(() => {
    const total = live.length;
    const neverOpened = live.filter((b) => !b.visitCount).length;
    const tagged = live.filter((b) => b.tags.length).length;
    const topVisited = [...live].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 6);
    const fc = {};
    live.forEach((b) => { const f = b.folder.split("/")[0]; fc[f] = (fc[f] || 0) + 1; });
    const folders = Object.entries(fc).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxF = folders[0]?.[1] || 1;
    const tc = {};
    live.forEach((b) => b.tags.forEach((t) => (tc[t] = (tc[t] || 0) + 1)));
    const tags = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 18);
    const maxT = tags[0]?.[1] || 1;
    return { total, neverOpened, tagged, topVisited, folders, maxF, tags, maxT };
  }, [live]);

  return (
    <div className="form">
      <div className="form-title"><Ic.Bars size={17} /> Stats</div>
      <div className="set-scroll scroll">
        <div className="stat-cards">
          <div className="stat-card"><div className="stat-num">{stats.total}</div><div className="stat-cap">bookmarks</div></div>
          <div className="stat-card"><div className="stat-num">{stats.neverOpened}</div><div className="stat-cap">never opened</div></div>
          <div className="stat-card"><div className="stat-num">{stats.total ? Math.round((stats.tagged / stats.total) * 100) : 0}%</div><div className="stat-cap">tagged</div></div>
        </div>

        <div className="stat-section">Most visited</div>
        <div className="stat-list">
          {stats.topVisited.map((b) => (
            <button key={b.id} className="stat-row" onClick={() => onOpen(b)}>
              <span className="stat-row-title">{b.title}</span>
              <span className="stat-row-meta">{b.visitCount || 0}× · {ago(b.lastVisited)}</span>
            </button>
          ))}
        </div>

        <div className="stat-section">Busiest folders</div>
        <div className="stat-bars">
          {stats.folders.map(([name, n]) => (
            <div key={name} className="stat-bar-row">
              <span className="stat-bar-label">{name}</span>
              <span className="stat-bar-track"><span className="stat-bar-fill" style={{ width: `${(n / stats.maxF) * 100}%` }} /></span>
              <span className="stat-bar-num">{n}</span>
            </div>
          ))}
        </div>

        {stats.tags.length > 0 && (
          <>
            <div className="stat-section">Tags</div>
            <div className="tag-cloud">
              {stats.tags.map(([t, n]) => (
                <span key={t} className="tag-cloud-item" style={{ fontSize: `${11 + (n / stats.maxT) * 8}px`, opacity: 0.55 + (n / stats.maxT) * 0.45 }}>#{t}</span>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
