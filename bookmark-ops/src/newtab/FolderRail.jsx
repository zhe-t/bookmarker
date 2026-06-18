import React, { useState, useEffect, useRef } from "react";
import * as Ic from "../ui/icons.jsx";

// Locate the tree node at a "/"-joined path; returns a pseudo-root for "".
function nodeAt(tree, path) {
  if (!path) return { children: tree };
  let nodes = tree, node = null;
  for (const part of path.split("/")) {
    node = (nodes || []).find((n) => n.name === part);
    if (!node) return { children: [] };
    nodes = node.children;
  }
  return node;
}

// A single row, shared by both modes. Tree mode adds an expand caret + indent.
function FolderItem({ f, depth, active, folderStyles, dropActive, expandable, expanded, onToggle, onOpen, onContextMenu, onDropBookmark }) {
  const fs = folderStyles[f.path] || {};
  return (
    <button className={`folder-item${active === f.path ? " on" : ""}${dropActive ? " folder-item--droppable" : ""}`}
      style={depth ? { paddingLeft: 9 + depth * 15 } : undefined}
      onClick={() => onOpen(f)} onContextMenu={(e) => onContextMenu(e, f)}
      onDragOver={(e) => { if (dropActive) e.preventDefault(); }}
      onDrop={(e) => onDropBookmark?.(e, f.path)}>
      {expandable && (
        f.children.length > 0
          ? <span className={`folder-caret${expanded ? " open" : ""}`} onClick={(e) => { e.stopPropagation(); onToggle(f.path); }}><Ic.ChevronD size={12} /></span>
          : <span className="folder-caret folder-caret--leaf" />
      )}
      {fs.emoji ? <span className="f-emoji">{fs.emoji}</span> : <Ic.Folder size={13} />}
      {fs.color && <span className="f-dot" style={{ background: fs.color }} />}
      <span className="folder-item-name">{f.name}</span>
      {!expandable && f.children.length > 0 && <Ic.Arrow size={12} className="folder-item-into" />}
      <span className="folder-item-count">{f.count}</span>
    </button>
  );
}

// Right-hand sidebar. Two layouts, toggled in the header:
//  • drill — children of the current level, with a breadcrumb (default)
//  • tree  — the full nested hierarchy, expand/collapse + indentation
export function FolderRail({ tree, nav, active, folderStyles = {}, dropActive, mode, onToggleMode, onOpen, onNavigate, onCreate, onContextMenu, onDropBookmark }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const inputRef = useRef(null);
  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  // auto-expand the ancestors of the active folder when in tree mode
  useEffect(() => {
    if (mode !== "tree" || !active) return;
    setExpanded((s) => {
      const n = new Set(s);
      active.split("/").reduce((acc, seg) => { const p = acc ? acc + "/" + seg : seg; n.add(p); return p; }, "");
      return n;
    });
  }, [active, mode]);

  const submit = () => { const n = name.trim(); if (n) onCreate(n); setName(""); setAdding(false); };
  const toggle = (path) => setExpanded((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  const shared = { active, folderStyles, dropActive, onOpen, onContextMenu, onDropBookmark };

  const drillChildren = nodeAt(tree, nav).children || [];
  const crumbs = nav ? nav.split("/") : [];

  const renderTree = (nodes, depth) => nodes.map((f) => (
    <React.Fragment key={f.path}>
      <FolderItem f={f} depth={depth} expandable expanded={expanded.has(f.path)} onToggle={toggle} {...shared} />
      {expanded.has(f.path) && f.children.length > 0 && renderTree(f.children, depth + 1)}
    </React.Fragment>
  ));

  return (
    <aside className="folder-rail">
      <div className="folder-rail-head">
        <span className="rail-label"><Ic.Folder size={12} /> Folders</span>
        <div className="seg-toggle folder-mode">
          <button className={`seg${mode !== "tree" ? " on" : ""}`} onClick={() => mode === "tree" && onToggleMode()} aria-label="Drill-down" title="Drill-down"><Ic.Arrow size={13} /></button>
          <button className={`seg${mode === "tree" ? " on" : ""}`} onClick={() => mode !== "tree" && onToggleMode()} aria-label="Nested tree" title="Nested tree"><Ic.Tree size={13} /></button>
        </div>
      </div>

      {mode !== "tree" && nav && (
        <div className="folder-crumbs scroll-x">
          <button className="crumb" onClick={() => onNavigate("")}>All</button>
          {crumbs.map((seg, i) => {
            const path = crumbs.slice(0, i + 1).join("/");
            return (
              <React.Fragment key={path}>
                <span className="crumb-sep">/</span>
                <button className={`crumb${i === crumbs.length - 1 ? " on" : ""}`} onClick={() => onNavigate(path)}>{seg}</button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div className="folder-rail-list scroll">
        <button className={`folder-item${!active ? " on" : ""}`} onClick={() => onNavigate("")}>
          <Ic.Rows size={13} />
          <span className="folder-item-name">All folders</span>
        </button>
        {mode === "tree"
          ? (tree.length ? renderTree(tree, 0) : <div className="folder-rail-empty">no folders</div>)
          : (drillChildren.length
              ? drillChildren.map((f) => <FolderItem key={f.path} f={f} depth={0} {...shared} />)
              : <div className="folder-rail-empty">no subfolders</div>)}
      </div>

      {adding ? (
        <div className="folder-rail-new">
          <input ref={inputRef} className="text-input" style={{ flex: 1, width: "auto" }} value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") { e.stopPropagation(); setAdding(false); setName(""); }
            }}
            onBlur={() => { if (!name.trim()) setAdding(false); }}
            placeholder="folder name" />
          <button className="btn btn--primary btn--icon" onClick={submit} aria-label="Create folder"><Ic.Check size={13} /></button>
        </div>
      ) : (
        <button className="btn btn--accent folder-rail-add" onClick={() => setAdding(true)}>
          <Ic.Plus size={13} /> New folder
        </button>
      )}
    </aside>
  );
}
