import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";

/* ───────────────────────── shared mock data (~520 bookmarks) ───────────────────────── */
function buildBookmarks(N = 520) {
  function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
  const rng=mulberry32(20260603);const pick=(a)=>a[Math.floor(rng()*a.length)];
  const SITES=[['github.com','Dev','#8b95a5'],['stackoverflow.com','Dev','#f48024'],['developer.mozilla.org','Dev','#111827'],['react.dev','Dev','#58c4dc'],['nodejs.org','Dev','#5fa04e'],['tailwindcss.com','Dev','#38bdf8'],['vercel.com','Dev','#111827'],['npmjs.com','Dev','#cb3837'],['docs.solana.com','Poll.fun','#14b885'],['anchor-lang.com','Poll.fun','#3b82f6'],['mixpanel.com','Poll.fun','#7856ff'],['linear.app','Poll.fun','#5e6ad2'],['anthropic.com','AI','#d97757'],['openai.com','AI','#10a37f'],['huggingface.co','AI','#f5a623'],['arxiv.org','AI','#b31b1b'],['tradingview.com','Trading','#2962ff'],['hyperliquid.xyz','Trading','#3fd0b6'],['coingecko.com','Trading','#8dc63f'],['dune.com','Trading','#f4603e'],['theathletic.com','Sports','#111827'],['espn.com','Sports','#d50a0a'],['premierleague.com','Sports','#3d195b'],['ufc.com','Sports','#d20a0a'],['nba.com','Sports','#1d428a'],['fbref.com','Sports','#18bc9c'],['pgatour.com','Sports','#003a70'],['news.ycombinator.com','Reading','#ff6600'],['techcrunch.com','Reading','#0a9c00'],['theverge.com','Reading','#5200ff'],['bloomberg.com','Reading','#111827'],['dribbble.com','Design','#ea4c89'],['figma.com','Design','#a259ff'],['mobbin.com','Design','#111827'],['awwwards.com','Design','#1f2937'],['notion.so','Work','#111827'],['ardupilot.org','UAV','#7ac142'],['px4.io','UAV','#159fdb'],['dji.com','UAV','#1f2937'],['seriouseats.com','Recipes','#c8102e'],['amazon.com','Shopping','#ff9900']];
  const PHRASES={Dev:['debounce a function','React server components','optimizing bundle size','TypeScript generics deep dive','useEffect cleanup patterns','CSS subgrid layout','WebSocket reconnection logic','async error boundaries','Docker multi-stage build','rate limiting middleware','Postgres index tuning','SwiftUI sheet lifecycle'],'Poll.fun':['Address Lookup Tables explained','bulk settlement design','PDA-derived ATAs','Anchor CPI patterns','versioned transactions','priority fee strategy','compute budget limits','USDC transfer guide','program upgrade authority'],AI:['transformer attention math','building RAG pipelines','prompt caching guide','LoRA fine-tuning','embeddings vector search','agent tool-use loops','eval harness design','long context windows'],Trading:['delta-neutral carry','funding rate arbitrage','grid trading bot','order book imbalance','perp basis trade','volatility harvesting','market making 101'],Sports:['Premier League matchday recap','Champions League draw','UFC main card preview','NBA trade deadline','PGA leaderboard live','expected goals analysis','transfer window tracker'],Reading:['the state of AI 2026','why startups fail','remote work culture','the attention economy','the case for small teams','founder mental health'],Design:['glassmorphism is back','design tokens at scale','bento grid layouts','micro-interaction patterns','building a color system','mobile nav patterns'],Work:['Q1 OKRs draft','sprint retro notes','investor update v3','roadmap planning','weekly KPI review'],UAV:['PID tuning guide','GPS failsafe setup','brushless motor sizing','flight controller firmware','obstacle avoidance stack'],Recipes:['weeknight tonkotsu ramen','sourdough starter guide','sheet-pan chicken','perfect cold brew ratio'],Shopping:['low-profile mechanical keyboard','electric standing desk','noise-cancelling headphones','XL dog crate review']};
  const EXTRA=['todo','reference','inspiration','readlater','important','archive','idea','tutorial','2026'];
  const cap=(s)=>s.charAt(0).toUpperCase()+s.slice(1);const now=Date.now(),DAY=864e5,items=[];
  for(let i=0;i<N;i++){const s=pick(SITES);let folder=s[1];const r=rng();if(r<0.34)folder='Unsorted';else if(r<0.44)folder=`${s[1]}/Archive`;const phrase=pick(PHRASES[s[1]]||PHRASES.Reading);const title=cap(phrase);const slug=phrase.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');const url=`https://${s[0]}/${slug}-${i}`;const dateAdded=now-Math.floor(rng()*720)*DAY-Math.floor(rng()*DAY);const never=rng()<0.45;const visitCount=never?0:1+Math.floor(rng()*rng()*60);const lastVisited=never?null:dateAdded+Math.floor(rng()*(now-dateAdded));const tags=[];if(rng()>0.28)tags.push(s[1].toLowerCase());if(rng()>0.6)tags.push(pick(EXTRA));if(rng()>0.85)tags.push(pick(EXTRA));const dead=rng()<0.08;items.push({id:i,title,url,domain:s[0],color:s[2],folder,tags:[...new Set(tags)],dateAdded,lastVisited,visitCount,dead,dupeOf:null});}
  for(let i=20;i<N;i++){if(rng()<0.06){const t=Math.floor(rng()*i);items[i].url=items[t].url;items[i].domain=items[t].domain;items[i].title=items[t].title;items[i].color=items[t].color;items[i].dupeOf=items[t].id;}}
  return items;
}

/* ───────────────────────── helpers ───────────────────────── */
const YEAR = 365 * 864e5;
const ago = (ts) => { if (!ts) return "never"; const d = Math.floor((Date.now() - ts) / 864e5); if (d < 1) return "today"; if (d < 30) return d + "d"; if (d < 365) return Math.floor(d / 30) + "mo"; return Math.floor(d / 365) + "y"; };
const fdate = (ts) => new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
function fuzzy(query, text) {
  if (!query) return { score: 0, hits: new Set() };
  const q = query.toLowerCase(), t = text.toLowerCase();
  let qi = 0, score = 0, streak = 0; const hits = new Set();
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { hits.add(i); qi++; streak++; score += 1 + streak * 0.6; if (i === 0 || /\s|\/|\.|-/.test(t[i - 1])) score += 3; } else streak = 0;
  }
  return qi === q.length ? { score, hits } : null;
}
// query operators: site: tag: is:dead|dupe|stale|untagged  >Nvisits
function parseQuery(raw) {
  const ops = { site: null, tag: null, is: null, minVisits: 0 };
  let text = raw;
  text = text.replace(/site:(\S+)/i, (_, v) => { ops.site = v.toLowerCase(); return ""; });
  text = text.replace(/tag:(\S+)/i, (_, v) => { ops.tag = v.toLowerCase(); return ""; });
  text = text.replace(/is:(dead|dupe|stale|untagged)/i, (_, v) => { ops.is = v.toLowerCase(); return ""; });
  text = text.replace(/>(\d+)\s*visits?/i, (_, v) => { ops.minVisits = +v; return ""; });
  return { ops, text: text.trim() };
}
// deterministic 12-week opens sparkline series
const spark = (b) => { let s = (b.id * 2654435761) >>> 0; const out = []; for (let i = 0; i < 12; i++) { s = (s * 1103515245 + 12345) >>> 0; out.push(b.visitCount === 0 ? 0 : (s % 9) + (i > 8 ? 2 : 0)); } return out; };

const SEM = { red: "#f87171", amber: "#fbbf24", green: "#34d399", blue: "#60a5fa" };
const SCOPES = [["all", "All"], ["recent", "Recent"], ["top", "Top"], ["untagged", "Untagged"], ["stale", "Stale"], ["dead", "Dead"], ["dupes", "Dupes"]];
const PRESETS = [
  { name: "Dead links", scope: "dead" }, { name: "Duplicates", scope: "dupes" },
  { name: "Unused Dev", scope: "stale", folder: "Dev" }, { name: "Untagged", scope: "untagged" }, { name: "Heavy hitters", scope: "top" },
];
const KW = { Dev:["react","typescript","css","docker","postgres","bundle","async","swiftui","websocket"], "Poll.fun":["solana","anchor","usdc","settlement","lookup","pda","transaction","fee"], AI:["transformer","rag","prompt","lora","embeddings","agent","eval","context"], Trading:["delta","funding","grid","order","perp","volatility","market"], Sports:["league","champions","ufc","nba","pga","goals","transfer"], Design:["glassmorphism","tokens","bento","interaction","color","nav"], Reading:["startups","remote","attention","teams","founder"] };
function suggestTags(b) {
  const text = (b.title + " " + b.domain).toLowerCase(); const out = new Set();
  for (const [cat, kws] of Object.entries(KW)) { if (kws.some((k) => text.includes(k))) out.add(cat.toLowerCase()); kws.forEach((k) => { if (text.includes(k)) out.add(k); }); }
  return [...out].slice(0, 3);
}

export default function BookmarkOpsV2() {
  const [data, setData] = useState(() => buildBookmarks());
  const [trashed, setTrashed] = useState(() => new Set());
  const [archived, setArchived] = useState(() => new Set());
  const [extra, setExtra] = useState(() => ({}));     // id -> [tags]
  const [moved, setMoved] = useState(() => ({}));     // id -> folder
  const [undoStack, setUndoStack] = useState([]);

  const [mode, setMode] = useState("search");
  const [cmd, setCmd] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [folder, setFolder] = useState(null);
  const [tag, setTag] = useState(null);
  const [group, setGroup] = useState(false);
  const [filters, setFilters] = useState(PRESETS);
  const [cur, setCur] = useState(0);
  const [tab, setTab] = useState("dead");
  const [tagInput, setTagInput] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);
  const [dupView, setDupView] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [scan, setScan] = useState({ active: false, pct: 0 });
  const [theme, setTheme] = useState("dark");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 680);
  const searchRef = useRef(null);
  const liveRegion = useRef(null);
  const fileRef = useRef(null);
  const swipe = useRef({ id: null, x0: 0, y0: 0, long: null, fired: false });
  const [swipeDx, setSwipeDx] = useState({ id: null, dx: 0 });

  useEffect(() => { const r = () => setIsMobile(window.innerWidth < 680); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);
  const say = useCallback((m) => { if (liveRegion.current) liveRegion.current.textContent = m; }, []);
  const flash = useCallback((m, undo) => { setToast({ m, undo }); say(m); setTimeout(() => setToast(null), 3000); }, [say]);

  const live = useMemo(() => data.filter((b) => !trashed.has(b.id) && !archived.has(b.id)).map((b) => {
    let x = b; if (moved[b.id]) x = { ...x, folder: moved[b.id] }; if (extra[b.id]) x = { ...x, tags: [...new Set([...x.tags, ...extra[b.id]])] }; return x;
  }), [data, trashed, archived, moved, extra]);

  const issues = useMemo(() => {
    const dead = [], dupes = [], stale = [], untagged = [];
    live.forEach((b) => { if (b.dead) dead.push(b); if (b.dupeOf != null) dupes.push(b); if (b.visitCount === 0 || (b.lastVisited && Date.now() - b.lastVisited > YEAR)) stale.push(b); if (b.tags.length === 0) untagged.push(b); });
    return { dead, dupes, stale, untagged };
  }, [live]);
  const score = useMemo(() => { const t = live.length || 1; const p = (issues.dead.length / t) * 45 + (issues.dupes.length / t) * 25 + (issues.stale.length / t) * 18 + (issues.untagged.length / t) * 12; return Math.max(0, Math.min(100, Math.round(100 - p))); }, [issues, live]);
  const scoreColor = score >= 80 ? SEM.green : score >= 55 ? SEM.amber : SEM.red;
  const folders = useMemo(() => [...new Set(live.map((b) => b.folder.split("/")[0]))].sort(), [live]);
  const allFolders = useMemo(() => [...new Set([...live.map((b) => b.folder), "Unsorted"])].sort(), [live]);
  const topTags = useMemo(() => { const c = {}; live.forEach((b) => b.tags.forEach((t) => (c[t] = (c[t] || 0) + 1))); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]); }, [live]);
  const dupGroups = useMemo(() => { const m = {}; live.forEach((b) => { (m[b.url] = m[b.url] || []).push(b); }); return Object.values(m).filter((g) => g.length > 1); }, [live]);
  const freq = useMemo(() => [...live].sort((a, b) => b.visitCount - a.visitCount).slice(0, 6), [live]);
  const recent = useMemo(() => live.filter((b) => b.lastVisited).sort((a, b) => b.lastVisited - a.lastVisited).slice(0, 6), [live]);
  const zero = !q && scope === "all" && !folder && !tag;

  const parsed = useMemo(() => parseQuery(q), [q]);
  const results = useMemo(() => {
    const { ops, text } = parsed;
    let pool = live;
    const is = ops.is || (scope === "untagged" ? "untagged" : scope === "dead" ? "dead" : scope === "dupes" ? "dupe" : scope === "stale" ? "stale" : null);
    if (is === "untagged") pool = pool.filter((b) => b.tags.length === 0);
    else if (is === "dead") pool = pool.filter((b) => b.dead);
    else if (is === "dupe") pool = pool.filter((b) => b.dupeOf != null);
    else if (is === "stale") pool = pool.filter((b) => b.visitCount === 0 || (b.lastVisited && Date.now() - b.lastVisited > YEAR));
    if (ops.site) pool = pool.filter((b) => b.domain.includes(ops.site));
    if (ops.minVisits) pool = pool.filter((b) => b.visitCount >= ops.minVisits);
    const tg = ops.tag || tag;
    if (tg) pool = pool.filter((b) => b.tags.includes(tg));
    if (folder) pool = pool.filter((b) => b.folder.split("/")[0] === folder);
    let scored = pool.map((b) => { const m = fuzzy(text, b.title + " " + b.domain + " " + b.tags.join(" ")); if (text && !m) return null; const rec = b.lastVisited ? Math.max(0, 1 - (Date.now() - b.lastVisited) / (400 * 864e5)) : 0; return { b, score: (m ? m.score : 0) + rec * 6 + Math.log2(b.visitCount + 1) * 1.5, hits: m ? m.hits : new Set() }; }).filter(Boolean);
    if (scope === "recent") scored.sort((a, b) => (b.b.lastVisited || 0) - (a.b.lastVisited || 0));
    else if (scope === "top") scored.sort((a, b) => b.b.visitCount - a.b.visitCount);
    else scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 90);
  }, [live, parsed, scope, folder, tag]);
  useEffect(() => { setCur(0); }, [q, scope, folder, tag]);
  useEffect(() => { say(`${results.length} results`); }, [results.length, say]);

  /* ── snapshots / undo ── */
  const snapshot = () => ({ trashed: new Set(trashed), archived: new Set(archived), extra: { ...extra }, moved: { ...moved } });
  const restore = (s) => { setTrashed(s.trashed); setArchived(s.archived); setExtra(s.extra); setMoved(s.moved); };
  const destructive = (label, fn) => { setUndoStack((st) => [...st.slice(-19), snapshot()]); fn(); flash(label, true); };
  const undo = () => setUndoStack((st) => { if (!st.length) { flash("Nothing to undo"); return st; } const s = st[st.length - 1]; restore(s); flash("Undone"); return st.slice(0, -1); });

  /* ── actions ── */
  const trash = (ids) => destructive(`Moved ${ids.length} to Trash`, () => { setTrashed((t) => { const n = new Set(t); ids.forEach((id) => n.add(id)); return n; }); setSel((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; }); });
  const askTrash = (ids) => { if (ids.length > 20) setConfirm({ msg: `Delete ${ids.length} bookmarks? They'll go to Trash and can be restored.`, run: () => { trash(ids); setConfirm(null); } }); else trash(ids); };
  const restoreItems = (ids) => destructive(`Restored ${ids.length}`, () => setTrashed((t) => { const n = new Set(t); ids.forEach((id) => n.delete(id)); return n; }));
  const emptyTrash = () => { const ids = [...trashed]; destructive(`Emptied Trash (${ids.length})`, () => { setData((d) => d.filter((b) => !trashed.has(b.id))); setTrashed(new Set()); }); };
  const archive = (ids) => destructive(`Archived ${ids.length}`, () => { setArchived((a) => { const n = new Set(a); ids.forEach((id) => n.add(id)); return n; }); setSel(new Set()); });
  const unarchive = (ids) => destructive(`Unarchived ${ids.length}`, () => setArchived((a) => { const n = new Set(a); ids.forEach((id) => n.delete(id)); return n; }));
  const tagIds = (ids, t) => { if (!t) return; destructive(`Tagged ${ids.length} #${t}`, () => setExtra((e) => { const n = { ...e }; ids.forEach((id) => { n[id] = [...new Set([...(n[id] || []), t])]; }); return n; })); };
  const moveIds = (ids, f) => { if (!f) return; destructive(`Moved ${ids.length} → ${f}`, () => { setMoved((m) => { const n = { ...m }; ids.forEach((id) => (n[id] = f)); return n; }); setSel(new Set()); }); setMoveOpen(false); };
  const autoMerge = () => { const kill = []; dupGroups.forEach((g) => { const s = [...g].sort((a, b) => b.visitCount - a.visitCount || b.dateAdded - a.dateAdded); s.slice(1).forEach((b) => kill.push(b.id)); }); if (!kill.length) return flash("No duplicates"); destructive(`Merged ${dupGroups.length} groups · −${kill.length}`, () => setTrashed((t) => { const n = new Set(t); kill.forEach((id) => n.add(id)); return n; })); };
  const killDead = () => { const ids = issues.dead.map((b) => b.id); if (!ids.length) return flash("No dead links"); askTrash(ids); };
  const applyFilter = (f) => { setScope(f.scope || "all"); setFolder(f.folder || null); setTag(f.tag || null); setQ(f.q || ""); setGroup(false); setMode("search"); setCmd(false); };
  const saveFilter = () => { const name = (folder ? folder + " " : "") + (SCOPES.find((s) => s[0] === scope)?.[1] || "All") + (tag ? " #" + tag : ""); setFilters((f) => [...f, { name, scope, folder, tag, q }]); flash(`Saved "${name}"`); };
  const clearSel = () => setSel(new Set());
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const rescan = () => { if (scan.active) return; setScan({ active: true, pct: 0 }); let p = 0; const iv = setInterval(() => { p += 7 + Math.random() * 10; if (p >= 100) { clearInterval(iv); setScan({ active: false, pct: 100 }); flash(`Scanned ${live.length} links · ${issues.dead.length} unreachable`); } else setScan({ active: true, pct: Math.min(99, Math.round(p)) }); }, 90); };

  const doExport = () => {
    const rows = live.map((b) => `    <DT><A HREF="${b.url}" ADD_DATE="${Math.floor(b.dateAdded/1e3)}" TAGS="${b.tags.join(',')}">${b.title}</A>`).join("\n");
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${rows}\n</DL><p>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = "bookmarks-export.html"; a.click();
    flash(`Exported ${live.length} bookmarks`);
  };
  const doImport = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const doc = new DOMParser().parseFromString(String(fr.result), "text/html");
        const existing = new Set(data.map((b) => b.url));
        const links = [...doc.querySelectorAll("a")].filter((a) => a.href && !existing.has(a.href));
        let nid = Math.max(...data.map((b) => b.id)) + 1;
        const add = links.slice(0, 400).map((a) => { try { const dom = new URL(a.href).hostname.replace(/^www\./, ""); const tags = (a.getAttribute("tags") || "").split(",").map((s) => s.trim()).filter(Boolean); return { id: nid++, title: a.textContent.trim() || dom, url: a.href, domain: dom, color: "#" + ((dom.length * 1234567) % 0xffffff).toString(16).padStart(6, "0"), folder: "Imported", tags, dateAdded: Date.now(), lastVisited: null, visitCount: 0, dead: false, dupeOf: null }; } catch { return null; } }).filter(Boolean);
        if (add.length) { setData((d) => [...d, ...add]); flash(`Imported ${add.length} new bookmarks`); } else flash("No new bookmarks found");
      } catch { flash("Couldn't parse that file"); }
    };
    fr.readAsText(f); e.target.value = "";
  };

  /* ── keyboard ── */
  useEffect(() => {
    const h = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); }
      else if (meta && e.key === "1") { e.preventDefault(); setMode("search"); }
      else if (meta && e.key === "2") { e.preventDefault(); setMode("cleanup"); }
      else if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if (e.key === "Escape") { setCmd(false); setDetail(null); setDupView(null); setConfirm(null); clearSel(); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });
  useEffect(() => { if (mode === "search" && !cmd && !isMobile) searchRef.current?.focus(); }, [mode, cmd, isMobile]);
  const onSearchKey = (e) => { if (e.key === "ArrowDown") { e.preventDefault(); setCur((c) => Math.min(c + 1, results.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(c - 1, 0)); } else if (e.key === "Enter" && results[cur]) setDetail(results[cur].b); };

  /* ── touch (swipe-to-trash + long-press select) ── */
  const tStart = (id) => (e) => { const t = e.touches[0]; swipe.current = { id, x0: t.clientX, y0: t.clientY, fired: false, long: setTimeout(() => { swipe.current.fired = true; toggleSel(id); }, 450) }; };
  const tMove = (e) => { const s = swipe.current; if (s.id == null) return; const t = e.touches[0]; const dx = t.clientX - s.x0, dy = t.clientY - s.y0; if (Math.abs(dy) > Math.abs(dx)) { clearTimeout(s.long); return; } if (Math.abs(dx) > 8) clearTimeout(s.long); setSwipeDx({ id: s.id, dx: Math.max(-120, Math.min(0, dx)) }); };
  const tEnd = () => { const s = swipe.current; clearTimeout(s.long); if (swipeDx.id === s.id && swipeDx.dx < -80) { trash([s.id]); } setSwipeDx({ id: null, dx: 0 }); swipe.current = { id: null, x0: 0, y0: 0, fired: false, long: null }; };

  const selArr = [...sel];
  const shared = { theme, isMobile, sel, toggleSel, setSel, setDetail, tStart, tMove, tEnd, swipeDx };

  return (
    <div data-theme={theme} style={wrap}>
      <style>{css}</style>
      <div ref={liveRegion} aria-live="polite" style={srOnly} />
      <input ref={fileRef} type="file" accept=".html,text/html" onChange={doImport} style={{ display: "none" }} />

      <div style={{ width: "100%", maxWidth: "min(920px, 100%)", paddingBottom: isMobile ? 86 : 0 }}>
        {/* header */}
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={brand}>◇ bookmark.ops</span>
            {!isMobile && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)" }}>✓ synced · {live.length} live</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={iconBtn} aria-label="Toggle theme">{theme === "dark" ? "☀" : "☾"}</button>
            <button onClick={() => fileRef.current?.click()} style={iconBtn} title="Import" aria-label="Import">↧</button>
            <button onClick={doExport} style={iconBtn} title="Export" aria-label="Export">↥</button>
            <button onClick={() => setMode("cleanup")} title="Health" style={healthPill(scoreColor)}><span style={{ width: 8, height: 8, borderRadius: 8, background: scoreColor }} /><span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: scoreColor }}>{score}</span></button>
            {!isMobile && <div style={toggleWrap}><button onClick={() => setMode("search")} style={toggleBtn(mode === "search")}>Search</button><button onClick={() => setMode("cleanup")} style={toggleBtn(mode === "cleanup")}>Cleanup</button></div>}
            {!isMobile && <button onClick={() => setCmd(true)} style={cmdHint}>⌘K</button>}
          </div>
        </div>

        <div style={panel}>
          {mode === "search" ? (
            <SearchView {...{ q, setQ, searchRef, onSearchKey, results, parsed, scope, setScope, folder, setFolder, folders, tag, setTag, topTags, filters, applyFilter, saveFilter, group, setGroup, zero, freq, recent, cur, setCur, ...shared }} />
          ) : (
            <CleanupView {...{ live, issues, score, scoreColor, dupGroups, tab, setTab, trashed, archived, data, askTrash, autoMerge, restoreItems, emptyTrash, unarchive, archive, tagIds, scan, rescan, setDupView, suggestTags, ...shared }} />
          )}
        </div>

        {/* bulk bar */}
        {sel.size > 0 && (
          <div style={bulkBar(isMobile)}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>{sel.size} selected</span>
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tagInput) { tagIds(selArr, tagInput); setTagInput(""); } }} placeholder="#tag…" style={bulkInput} aria-label="Add tag to selection" />
            <button onClick={() => { if (tagInput) { tagIds(selArr, tagInput); setTagInput(""); } }} style={bulkBtn(true)}>Tag</button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setMoveOpen(!moveOpen)} style={bulkBtn(false)}>Move ▾</button>
              {moveOpen && (
                <div style={movePop} className="scroll">
                  <div style={{ display: "flex", gap: 6, padding: 6 }}>
                    <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="new folder" style={{ ...bulkInput, width: 110 }} />
                    <button onClick={() => { if (newFolder) { moveIds(selArr, newFolder); setNewFolder(""); } }} style={bulkBtn(true)}>＋</button>
                  </div>
                  {allFolders.map((f) => <button key={f} onClick={() => moveIds(selArr, f)} style={moveItem}>{f}</button>)}
                </div>
              )}
            </div>
            <button onClick={() => archive(selArr)} style={bulkBtn(false)}>Archive</button>
            <button onClick={() => askTrash(selArr)} style={bulkBtn(false, SEM.red)}>Delete</button>
            <button onClick={clearSel} style={{ ...bulkBtn(false), color: "var(--dim)" }}>✕</button>
          </div>
        )}

        {/* mobile bottom nav + FAB */}
        {isMobile && (
          <div style={bottomNav}>
            <button onClick={() => setMode("search")} style={navBtn(mode === "search")}>🔍<span style={{ fontSize: 11 }}>Search</span></button>
            <button onClick={() => setCmd(true)} style={fab}>⌘</button>
            <button onClick={() => setMode("cleanup")} style={navBtn(mode === "cleanup")}>🧹<span style={{ fontSize: 11 }}>Cleanup</span></button>
          </div>
        )}

        {cmd && <CommandPalette {...{ setCmd, live, setMode, autoMerge, killDead, clearSel, hasSel: sel.size > 0, saveFilter, filters, applyFilter, dupGroups, issues, flash, undo, doExport, rescan, setDetail, isMobile, theme }} />}
        {detail && <DetailDrawer {...{ b: detail, close: () => setDetail(null), isMobile, theme, tagIds, moveIds: (id, f) => moveIds([id], f), archive: (id) => archive([id]), trash: (id) => askTrash([id]), allFolders, flash }} />}
        {dupView && <DupViewer {...{ group: dupView, close: () => setDupView(null), keep: (keepId) => { destructive("Merged duplicate group", () => setTrashed((t) => { const n = new Set(t); dupView.forEach((b) => { if (b.id !== keepId) n.add(b.id); }); return n; })); setDupView(null); }, theme }} />}
        {confirm && <ConfirmDialog {...{ confirm, cancel: () => setConfirm(null), theme }} />}

        {toast && <div style={toastStyle} role="status">{toast.m}{toast.undo && <button onClick={undo} style={toastUndo}>Undo</button>}</div>}
        {!isMobile && <p style={hint}>Search to retrieve · Cleanup to prune · select rows for bulk tag / move / archive / delete · <span className="kbd">⌘K</span> palette · <span className="kbd">⌘Z</span> undo. Try operators like <code style={code}>is:dead</code>, <code style={code}>site:github</code>, <code style={code}>tag:ai</code>, <code style={code}>&gt;10 visits</code>.</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── search view ───────────────────────── */
function SearchView(p) {
  const { q, setQ, searchRef, onSearchKey, results, parsed, scope, setScope, folder, setFolder, folders, tag, setTag, topTags, filters, applyFilter, saveFilter, group, setGroup, zero, freq, recent } = p;
  const Row = (props) => <BMRow {...props} {...p} />;
  const grouped = useMemo(() => { if (!group) return null; const m = {}; results.forEach((r) => { const f = r.b.folder.split("/")[0]; (m[f] = m[f] || []).push(r); }); return Object.entries(m).sort((a, b) => b[1].length - a[1].length); }, [group, results]);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ color: "var(--accent)", fontSize: 18, fontFamily: "var(--mono)" }}>⌘</span>
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder="Search 500+ — try is:dead, tag:ai, >10 visits…" style={input} aria-label="Search bookmarks" />
        <span className="kbd">{results.length}</span>
      </div>
      <div className="rail scroll-x" style={railRow}>
        <span style={railLabel}>filters</span>
        {filters.map((f, i) => { const on = scope === (f.scope || "all") && (f.folder || null) === folder && (f.tag || null) === tag && (f.q || "") === q; return <button key={i} onClick={() => applyFilter(f)} className="pill" style={pill(on, !PRESETS.includes(f))}>{f.name}</button>; })}
        <button onClick={saveFilter} className="pill" style={{ ...pill(false), color: "var(--accent)", borderStyle: "dashed" }}>+ save</button>
      </div>
      <div className="rail scroll-x" style={railRow}>
        {SCOPES.map(([k, l]) => <button key={k} onClick={() => setScope(k)} className="pill" style={pill(scope === k)}>{l}</button>)}
        <select value={folder || ""} onChange={(e) => setFolder(e.target.value || null)} style={selStyle} aria-label="Folder filter"><option value="">folders</option>{folders.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        {topTags.map((t) => <button key={t} onClick={() => setTag(tag === t ? null : t)} className="pill" style={pill(tag === t, true)}>#{t}</button>)}
        <button onClick={() => setGroup(!group)} className="pill" style={pill(group)}>⊞ group</button>
      </div>

      <div className="scroll" style={{ maxHeight: "min(56dvh, 460px)", overflowY: "auto" }} role="listbox" aria-label="Results">
        {zero && (
          <>
            <Section title="Jump back in">{freq.map((b) => <Row key={b.id} b={b} hits={new Set()} />)}</Section>
            <Section title="Recently opened">{recent.map((b) => <Row key={b.id} b={b} hits={new Set()} />)}</Section>
            <div style={railLabel2}>All {results.length} bookmarks</div>
          </>
        )}
        {results.length === 0 && <Empty>No matches{parsed.ops.is || parsed.ops.site ? " — try relaxing an operator" : ""}.</Empty>}
        {!zero && group && grouped ? grouped.map(([f, rows]) => (
          <div key={f}><div style={stickyHdr}>{f} · {rows.length}</div>{rows.map((r) => <Row key={r.b.id} b={r.b} hits={r.hits} />)}</div>
        )) : (zero ? results.slice(0, 30) : results).map((r, i) => <Row key={r.b ? r.b.id : r.id} b={r.b || r} hits={r.hits || new Set()} idx={i} />)}
      </div>
      <div style={footer}><span className="kbd">↑↓</span> nav <span className="kbd">↵</span> details <span style={{ marginLeft: "auto", color: "var(--line2)" }}>recency × frequency × match</span></div>
    </>
  );
}

function BMRow({ b, hits, idx, theme, isMobile, sel, toggleSel, setDetail, tStart, tMove, tEnd, swipeDx, cur, setCur }) {
  const checked = sel.has(b.id);
  const dx = swipeDx.id === b.id ? swipeDx.dx : 0;
  const on = idx != null && cur === idx;
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div style={swipeReveal}>🗑</div>
      <div role="option" aria-selected={on}
        onMouseEnter={() => idx != null && setCur && setCur(idx)}
        onClick={() => { if (!swipe_consumed(b.id)) setDetail(b); }}
        onTouchStart={isMobile ? tStart(b.id) : undefined} onTouchMove={isMobile ? tMove : undefined} onTouchEnd={isMobile ? tEnd : undefined}
        style={{ ...row(on, checked), transform: `translateX(${dx}px)`, transition: dx ? "none" : "transform .18s ease" }}>
        <button onClick={(e) => { e.stopPropagation(); toggleSel(b.id); }} style={checkbox(checked)} aria-label="Select">{checked ? "✓" : ""}</button>
        <div style={{ ...fav, background: b.color }}>{b.domain[0].toUpperCase()}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...rowTitle, textDecoration: b.dead ? "line-through" : "none", opacity: b.dead ? 0.55 : 1 }}>{b.title.split("").map((c, j) => hits.has(j) ? <span key={j} style={{ color: "var(--accent)", fontWeight: 800 }}>{c}</span> : c)}</div>
          <div style={meta}>{b.domain} · {b.folder}</div>
        </div>
        <div style={rowRight}>
          {b.dead && <span style={badge("#3a1d1d", SEM.red)}>dead</span>}
          {b.dupeOf != null && <span style={badge("#3a2f17", SEM.amber)}>dupe</span>}
          {!isMobile && b.tags.slice(0, 2).map((t) => <span key={t} style={badge("var(--panel2)", "var(--dim)")}>#{t}</span>)}
          <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{b.visitCount > 0 ? `${b.visitCount}×` : "·"} {ago(b.lastVisited)}</span>
        </div>
      </div>
    </div>
  );
}
const _consumed = {};
function swipe_consumed() { return false; } // taps always open; swipe handled separately

/* ───────────────────────── cleanup view ───────────────────────── */
function CleanupView(p) {
  const { live, issues, score, scoreColor, dupGroups, tab, setTab, trashed, archived, data, askTrash, autoMerge, restoreItems, emptyTrash, unarchive, archive, tagIds, scan, rescan, setDupView, suggestTags, isMobile } = p;
  const trashList = useMemo(() => data.filter((b) => trashed.has(b.id)), [data, trashed]);
  const archList = useMemo(() => data.filter((b) => archived.has(b.id)), [data, archived]);
  const tabs = [["dead", "Dead", issues.dead, SEM.red], ["dupes", "Dupes", issues.dupes, SEM.amber], ["stale", "Stale", issues.stale, SEM.blue], ["untagged", "Untagged", issues.untagged, SEM.green], ["trash", "Trash", trashList, "var(--dim)"], ["archived", "Archived", archList, "var(--dim)"]];
  const active = tabs.find((t) => t[0] === tab); const rows = active[2]; const col = active[3];
  const ids = rows.map((r) => r.id); const allSel = ids.length && ids.every((id) => p.sel.has(id));
  const selectAll = () => p.setSel((s) => { const n = new Set(s); allSel ? ids.forEach((id) => n.delete(id)) : ids.forEach((id) => n.add(id)); return n; });
  const tiles = [["Live", live.length, "var(--text)"], ["Dead", issues.dead.length, SEM.red], ["Dupes", issues.dupes.length, SEM.amber], ["Stale", issues.stale.length, SEM.blue], ["Untag", issues.untagged.length, SEM.green]];
  return (
    <div style={{ padding: isMobile ? 14 : 18 }}>
      {issues.stale.length > 30 && tab !== "trash" && <div style={nudge}>📦 {issues.stale.length} bookmarks untouched 1y+. Archive them to declutter without deleting.</div>}
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <Gauge value={score} color={scoreColor} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, flex: 1, minWidth: 220 }}>
          {tiles.map(([l, n, c]) => <div key={l} style={tile}><div style={{ fontFamily: "var(--mono)", fontSize: "clamp(20px,5vw,30px)", fontWeight: 700, color: c }}>{n}</div><div style={{ fontSize: 11, color: "var(--dim)" }}>{l}</div></div>)}
        </div>
      </div>
      {/* scan bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={rescan} style={mergeBtn}>{scan.active ? `Scanning… ${scan.pct}%` : "↻ Re-scan links"}</button>
        {scan.active && <div style={{ flex: 1, height: 5, background: "var(--panel2)", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: scan.pct + "%", background: "var(--accent)" }} /></div>}
      </div>
      <div className="rail scroll-x" style={{ ...railRow, borderBottom: "none", paddingLeft: 0 }}>
        {tabs.map(([k, l, list, c]) => <button key={k} onClick={() => setTab(k)} style={tabBtn(tab === k, c)}>{l} <span style={{ opacity: .7 }}>{list.length}</span></button>)}
      </div>
      {tab === "dupes" && dupGroups.length > 0 && <button onClick={autoMerge} style={{ ...mergeBtn, marginBottom: 10 }}>⚡ Auto-merge {dupGroups.length} groups · keep most-visited</button>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 9, marginBottom: 8 }}>
        <button onClick={selectAll} style={checkbox(allSel)}>{allSel ? "✓" : ""}</button>
        <span style={{ fontSize: 12.5, color: "var(--dim)" }}>Select all {rows.length}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {tab === "trash" ? (<><button disabled={!ids.some((id) => p.sel.has(id))} onClick={() => restoreItems(ids.filter((id) => p.sel.has(id)))} style={miniBtn}>Restore</button><button onClick={emptyTrash} style={{ ...miniBtn, color: SEM.red, borderColor: SEM.red + "55" }}>Empty trash</button></>)
            : tab === "archived" ? <button disabled={!ids.some((id) => p.sel.has(id))} onClick={() => unarchive(ids.filter((id) => p.sel.has(id)))} style={miniBtn}>Unarchive</button>
            : (<><button disabled={!ids.some((id) => p.sel.has(id))} onClick={() => archive(ids.filter((id) => p.sel.has(id)))} style={miniBtn}>Archive</button><button disabled={!ids.some((id) => p.sel.has(id))} onClick={() => askTrash(ids.filter((id) => p.sel.has(id)))} style={{ ...miniBtn, color: SEM.red, borderColor: SEM.red + "55" }}>Delete</button></>)}
        </div>
      </div>

      <div className="scroll" style={{ maxHeight: "min(40dvh, 280px)", overflowY: "auto", border: "1px solid var(--line)", borderRadius: 9 }}>
        {rows.length === 0 && <Empty ok>✓ Clean.</Empty>}
        {rows.slice(0, 120).map((b, i) => {
          const checked = p.sel.has(b.id);
          const sug = tab === "untagged" ? suggestTags(b) : [];
          return (
            <div key={b.id} style={row(false, checked, i < rows.length - 1)} onClick={() => p.toggleSel(b.id)}>
              <button onClick={(e) => { e.stopPropagation(); p.toggleSel(b.id); }} style={checkbox(checked)}>{checked ? "✓" : ""}</button>
              <div style={{ ...fav, background: b.color }}>{b.domain[0].toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitle}>{b.title}</div>
                {tab === "untagged" && sug.length > 0
                  ? <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>{sug.map((t) => <button key={t} onClick={(e) => { e.stopPropagation(); tagIds([b.id], t); }} style={sugChip}>+ {t}</button>)}</div>
                  : <div style={meta}>{b.domain} · {b.folder}</div>}
              </div>
              {tab === "dupes" && <button onClick={(e) => { e.stopPropagation(); setDupView(dupGroups.find((g) => g.some((x) => x.id === b.id)) || [b]); }} style={miniBtn}>view</button>}
              <span style={{ fontSize: 11.5, color: col, fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{tab === "dead" ? "404" : tab === "dupes" ? "#" + b.dupeOf : tab === "stale" ? (b.visitCount === 0 ? "unopened" : "1y+") : tab === "trash" ? "trashed" : tab === "archived" ? "archived" : "no tags"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Gauge({ value, color }) {
  const r = 32, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div style={{ position: "relative", width: 86, height: 86, flexShrink: 0 }}>
      <svg width="86" height="86" style={{ transform: "rotate(-90deg)" }}><circle cx="43" cy="43" r={r} fill="none" stroke="var(--line)" strokeWidth="8" /><circle cx="43" cy="43" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="gauge" /></svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

/* ───────────────────────── overlays ───────────────────────── */
function CommandPalette({ setCmd, live, setMode, autoMerge, killDead, clearSel, hasSel, saveFilter, filters, applyFilter, dupGroups, issues, flash, undo, doExport, rescan, setDetail, isMobile }) {
  const [q, setQ] = useState(""); const [i, setI] = useState(0); const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const actions = useMemo(() => {
    const a = [
      { label: "Go to Search", hint: "⌘1", run: () => { setMode("search"); setCmd(false); } },
      { label: "Go to Cleanup", hint: "⌘2", run: () => { setMode("cleanup"); setCmd(false); } },
      { label: `Auto-merge ${dupGroups.length} duplicate groups`, run: () => { autoMerge(); setCmd(false); } },
      { label: `Delete all ${issues.dead.length} dead links`, run: () => { killDead(); setCmd(false); } },
      { label: "Re-scan links", run: () => { rescan(); setCmd(false); } },
      { label: "Undo last action", hint: "⌘Z", run: () => { undo(); setCmd(false); } },
      { label: "Export bookmarks (.html)", run: () => { doExport(); setCmd(false); } },
      { label: "Save current filter", run: () => { saveFilter(); setCmd(false); } },
      ...(hasSel ? [{ label: "Clear selection", hint: "esc", run: () => { clearSel(); setCmd(false); } }] : []),
      ...filters.map((f) => ({ label: "Filter · " + f.name, run: () => applyFilter(f) })),
    ];
    return q ? a.filter((x) => x.label.toLowerCase().includes(q.toLowerCase())) : a;
  }, [q, dupGroups, issues, hasSel, filters]);
  const bms = useMemo(() => q ? live.map((b) => { const m = fuzzy(q, b.title + " " + b.domain); return m ? { b, s: m.score } : null; }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 6) : [], [q, live]);
  const flat = [...actions.map((a) => ({ type: "a", a })), ...bms.map((x) => ({ type: "b", b: x.b }))];
  useEffect(() => { setI(0); }, [q]);
  const onKey = (e) => { if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, flat.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); } else if (e.key === "Enter") { const it = flat[i]; if (it?.type === "a") it.a.run(); else if (it?.type === "b") { setDetail(it.b); setCmd(false); } } else if (e.key === "Escape") setCmd(false); };
  return (
    <div style={overlay(isMobile)} onClick={() => setCmd(false)}>
      <div style={paletteBox(isMobile)} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--line)" }}><span style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>⌘</span><input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Run an action or jump to a bookmark…" style={input} /></div>
        <div className="scroll" style={{ maxHeight: isMobile ? "70dvh" : 380, overflowY: "auto", padding: 6 }}>
          {actions.length > 0 && <div style={palHdr}>Actions</div>}
          {flat.map((it, idx) => it.type === "a" ? (
            <div key={"a" + idx} onMouseEnter={() => setI(idx)} onClick={() => it.a.run()} style={palRow(idx === i)}><span style={{ color: "var(--accent)" }}>▸</span><span style={{ flex: 1, fontSize: 15, color: "var(--text)" }}>{it.a.label}</span>{it.a.hint && <span className="kbd">{it.a.hint}</span>}</div>
          ) : (
            <React.Fragment key={"b" + idx}>{idx === actions.length && <div style={palHdr}>Bookmarks</div>}<div onMouseEnter={() => setI(idx)} onClick={() => { setDetail(it.b); setCmd(false); }} style={palRow(idx === i)}><div style={{ ...fav, width: 22, height: 22, fontSize: 11, background: it.b.color }}>{it.b.domain[0].toUpperCase()}</div><span style={{ flex: 1, fontSize: 15, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.b.title}</span></div></React.Fragment>
          ))}
          {flat.length === 0 && <Empty>No matches.</Empty>}
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ b, close, isMobile, tagIds, moveIds, archive, trash, allFolders, flash }) {
  const [tg, setTg] = useState(""); const [mv, setMv] = useState(false);
  const s = spark(b); const max = Math.max(1, ...s);
  return (
    <div style={overlay(isMobile)} onClick={close}>
      <div style={drawer(isMobile)} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...favLg, background: b.color }}>{b.domain[0].toUpperCase()}</div>
          <button onClick={close} style={iconBtn}>✕</button>
        </div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: "clamp(20px,5vw,26px)", color: "var(--text)", marginTop: 14, lineHeight: 1.2 }}>{b.title}</div>
        <a href={b.url} onClick={(e) => { e.preventDefault(); flash("Opened · " + b.domain); }} style={{ display: "block", fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--accent)", marginTop: 8, wordBreak: "break-all" }}>{b.url}</a>
        {b.dead && <div style={deadTag}>⚠ Dead link — last check failed</div>}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 50, marginTop: 18 }}>
          {s.map((v, i) => <div key={i} title={`wk ${i + 1}: ${v}`} style={{ flex: 1, height: `${(v / max) * 100}%`, minHeight: 3, background: v ? "var(--accent)" : "var(--line)", borderRadius: 3 }} />)}
        </div>
        <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--mono)", marginTop: 4 }}>opens / week · 12 wks · {b.visitCount} total</div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9 }}>
          <Meta l="Folder" v={b.folder} /><Meta l="Added" v={fdate(b.dateAdded)} /><Meta l="Last opened" v={b.lastVisited ? ago(b.lastVisited) + " ago" : "never"} />
        </div>
        {b.tags.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>{b.tags.map((t) => <span key={t} style={badge("var(--panel2)", "var(--dim)")}>#{t}</span>)}</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
          <input value={tg} onChange={(e) => setTg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tg) { tagIds([b.id], tg); setTg(""); } }} placeholder="#tag" style={{ ...bulkInput, width: 90 }} />
          <button onClick={() => { if (tg) { tagIds([b.id], tg); setTg(""); } }} style={bulkBtn(true)}>Tag</button>
          <button onClick={() => setMv(!mv)} style={bulkBtn(false)}>Move</button>
          <button onClick={() => { archive(b.id); close(); }} style={bulkBtn(false)}>Archive</button>
          <button onClick={() => { trash(b.id); close(); }} style={bulkBtn(false, SEM.red)}>Delete</button>
        </div>
        {mv && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>{allFolders.slice(0, 12).map((f) => <button key={f} onClick={() => { moveIds(b.id, f); close(); }} style={moveItem}>{f}</button>)}</div>}
      </div>
    </div>
  );
}
const Meta = ({ l, v }) => <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}><span style={{ fontSize: 12.5, color: "var(--dim)" }}>{l}</span><span style={{ fontSize: 12.5, color: "var(--text)", fontFamily: "var(--mono)" }}>{v}</span></div>;

function DupViewer({ group, close, keep, isMobile }) {
  return (
    <div style={overlay()} onClick={close}>
      <div style={{ ...paletteBox(false), padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, color: "var(--text)", marginBottom: 4 }}>Duplicate group</div>
        <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 14 }}>{group.length} copies of the same URL — pick the one to keep, the rest go to Trash.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...group].sort((a, b) => b.visitCount - a.visitCount).map((b, i) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: "1px solid var(--line)", borderRadius: 10, background: i === 0 ? "var(--sel)" : "transparent" }}>
              <div style={{ ...fav, background: b.color }}>{b.domain[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={rowTitle}>{b.title}{i === 0 && <span style={{ ...badge("var(--accent)", "var(--accent-ink)"), marginLeft: 8 }}>most visited</span>}</div><div style={meta}>{b.visitCount}× · {b.folder} · added {fdate(b.dateAdded)}</div></div>
              <button onClick={() => keep(b.id)} style={bulkBtn(i === 0)}>Keep this</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function ConfirmDialog({ confirm, cancel }) {
  return (
    <div style={overlay()} onClick={cancel}>
      <div style={{ ...paletteBox(false), maxWidth: 420, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 19, color: "var(--text)", marginBottom: 10 }}>Confirm</div>
        <div style={{ fontSize: 14, color: "var(--dim)", lineHeight: 1.5, marginBottom: 20 }}>{confirm.msg}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button onClick={cancel} style={bulkBtn(false)}>Cancel</button><button onClick={confirm.run} style={bulkBtn(true)}>Confirm</button></div>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => <div><div style={railLabel2}>{title}</div>{children}</div>;
const Empty = ({ children, ok }) => <div style={{ ...empty, color: ok ? SEM.green : "var(--dim)" }}>{children}</div>;

/* ───────────────────────── styles ───────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
[data-theme=dark]{--bg:radial-gradient(1200px 600px at 50% -10%,#15171c 0%,#0b0c0f 60%);--panel:#0f1116;--panel2:#0b0c0f;--line:#1e2127;--line2:#262a31;--text:#e8eaed;--dim:#6b7280;--sel:rgba(198,242,78,.07);--selc:rgba(198,242,78,.05)}
[data-theme=light]{--bg:#eef1f6;--panel:#ffffff;--panel2:#f3f5f9;--line:#e4e8ef;--line2:#eef1f5;--text:#1a1f2b;--dim:#7c8595;--sel:rgba(101,163,13,.10);--selc:rgba(101,163,13,.06)}
*{--accent:#c6f24e;--accent-ink:#0b0c0f;--mono:'IBM Plex Mono',monospace;--display:'Bricolage Grotesque',sans-serif}
[data-theme=light] *{--accent:#5fa800}
.scroll::-webkit-scrollbar{width:9px;height:9px}.scroll::-webkit-scrollbar-thumb{background:var(--line2);border-radius:9px}.scroll::-webkit-scrollbar-track{background:transparent}
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}.scroll-x::-webkit-scrollbar{height:0}
.rail{scrollbar-width:none}
.pill{transition:all .12s ease;white-space:nowrap}.pill:hover{filter:brightness(1.15)}
.kbd{font-family:var(--mono);font-size:11px;color:var(--dim);background:var(--panel2);border:1px solid var(--line2);border-radius:5px;padding:1px 6px}
button{transition:all .13s ease;font-family:inherit}select{outline:none}input{font-family:inherit}
.gauge{transition:stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1),stroke .3s}
@media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}.gauge{transition:none}}
@media (pointer:coarse){.pill{padding:9px 14px!important;font-size:13px!important}}
`;
const srOnly = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };
const wrap = { minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(14px,3vw,34px) clamp(10px,3vw,18px) 40px", fontFamily: "'IBM Plex Sans',sans-serif", color: "var(--text)" };
const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 };
const brand = { fontFamily: "var(--mono)", fontSize: "clamp(13px,3.4vw,15px)", color: "var(--accent)", letterSpacing: 0.5, fontWeight: 600, whiteSpace: "nowrap" };
const toggleWrap = { display: "flex", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 3 };
const toggleBtn = (on) => ({ fontSize: 13, padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "transparent", color: on ? "var(--accent-ink)" : "var(--dim)", fontWeight: on ? 700 : 500 });
const iconBtn = { width: 34, height: 34, borderRadius: 9, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--dim)", cursor: "pointer", fontSize: 15 };
const healthPill = (c) => ({ display: "flex", alignItems: "center", gap: 7, background: "var(--panel)", border: `1px solid ${c}55`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontSize: 13, height: 34 });
const cmdHint = { fontFamily: "var(--mono)", fontSize: 12, color: "var(--dim)", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "0 11px", height: 34, cursor: "pointer" };
const panel = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 40px 120px -24px rgba(0,0,0,.55)", overflow: "hidden" };
const input = { flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: "clamp(15px,4vw,17px)", fontFamily: "'IBM Plex Sans',sans-serif", minWidth: 0 };
const railRow = { display: "flex", gap: 6, padding: "10px 14px", borderBottom: "1px solid var(--line)", alignItems: "center", flexWrap: "nowrap" };
const railLabel = { fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 };
const railLabel2 = { fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 1, padding: "12px 16px 6px" };
const stickyHdr = { position: "sticky", top: 0, background: "var(--panel)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--dim)", padding: "8px 16px", borderBottom: "1px solid var(--line)", zIndex: 1, textTransform: "uppercase", letterSpacing: 1 };
const pill = (on, t) => ({ fontFamily: "var(--mono)", fontSize: 12, padding: "5px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "var(--accent)" : "var(--line2)"), background: on ? "var(--sel)" : "transparent", color: on ? "var(--accent)" : "var(--dim)", flexShrink: 0 });
const selStyle = { fontFamily: "var(--mono)", fontSize: 12, padding: "5px 8px", borderRadius: 8, background: "var(--panel2)", color: "var(--dim)", border: "1px solid var(--line2)", cursor: "pointer", flexShrink: 0 };
const row = (on, checked, border) => ({ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", cursor: "pointer", background: checked ? "var(--sel)" : on ? "var(--selc)" : "var(--panel)", borderLeft: "2px solid " + (on ? "var(--accent)" : "transparent"), borderBottom: border ? "1px solid var(--line)" : "none", minHeight: 52 });
const rowTitle = { fontSize: "clamp(14px,3.6vw,15px)", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 };
const rowRight = { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 };
const checkbox = (on) => ({ width: 22, height: 22, borderRadius: 6, border: "1.5px solid " + (on ? "var(--accent)" : "var(--line2)"), background: on ? "var(--accent)" : "transparent", color: "var(--accent-ink)", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 });
const fav = { width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0, fontFamily: "'IBM Plex Sans',sans-serif" };
const favLg = { width: 56, height: 56, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 26, fontFamily: "var(--display)" };
const meta = { fontSize: 11.5, color: "var(--dim)", fontFamily: "var(--mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 };
const badge = (bg, col) => ({ fontFamily: "var(--mono)", fontSize: 10.5, padding: "2px 6px", borderRadius: 5, background: bg, color: col, flexShrink: 0, whiteSpace: "nowrap" });
const footer = { display: "flex", gap: 10, alignItems: "center", padding: "11px 16px", borderTop: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--dim)" };
const empty = { padding: 36, textAlign: "center", fontFamily: "var(--mono)", fontSize: 14 };
const tile = { background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 8px", textAlign: "center" };
const tabBtn = (on, c) => ({ background: on ? (typeof c === "string" && c.startsWith("var") ? "var(--sel)" : c + "22") : "transparent", color: on ? c : "var(--dim)", border: `1px solid ${on ? (typeof c === "string" && c.startsWith("var") ? "var(--accent)" : c + "66") : "var(--line2)"}`, borderRadius: 8, padding: "7px 13px", fontSize: 13, cursor: "pointer", flexShrink: 0 });
const mergeBtn = { background: "transparent", border: "1px dashed var(--line2)", color: "var(--accent)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--mono)" };
const miniBtn = { background: "transparent", border: "1px solid var(--line2)", color: "var(--dim)", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer" };
const nudge = { background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text)", marginBottom: 14 };
const sugChip = { fontFamily: "var(--mono)", fontSize: 11.5, padding: "3px 9px", borderRadius: 7, border: "1px dashed var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer" };
const bulkBar = (m) => ({ position: "fixed", bottom: m ? 78 : 22, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: 14, padding: "10px 12px", boxShadow: "0 20px 50px -10px rgba(0,0,0,.5)", zIndex: 55, maxWidth: "94vw", overflowX: "auto", paddingBottom: `calc(10px + env(safe-area-inset-bottom,0px))` });
const bulkInput = { background: "var(--panel2)", border: "1px solid var(--line2)", borderRadius: 8, padding: "7px 10px", color: "var(--text)", fontSize: 13, outline: "none", width: 80, fontFamily: "var(--mono)" };
const bulkBtn = (primary, col) => ({ background: primary ? "var(--accent)" : "transparent", color: primary ? "var(--accent-ink)" : (col || "var(--text)"), border: "1px solid " + (primary ? "var(--accent)" : (col ? col + "66" : "var(--line2)")), borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: primary ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" });
const movePop = { position: "absolute", bottom: "calc(100% + 8px)", left: 0, background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: 12, boxShadow: "0 20px 50px -10px rgba(0,0,0,.6)", padding: 6, width: 180, maxHeight: 240, overflowY: "auto", zIndex: 60 };
const moveItem = { width: "100%", textAlign: "left", padding: "7px 10px", border: "none", background: "transparent", color: "var(--text)", fontSize: 12.5, cursor: "pointer", borderRadius: 6, fontFamily: "var(--mono)" };
const bottomNav = { position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "var(--panel)", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 40, paddingBottom: "env(safe-area-inset-bottom,0px)" };
const navBtn = (on) => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "transparent", border: "none", color: on ? "var(--accent)" : "var(--dim)", fontSize: 18, cursor: "pointer", padding: 8 });
const fab = { width: 52, height: 52, borderRadius: 16, background: "var(--accent)", color: "var(--accent-ink)", border: "none", fontSize: 22, fontFamily: "var(--mono)", cursor: "pointer", marginTop: -22, boxShadow: "0 10px 24px -6px rgba(0,0,0,.4)" };
const overlay = (m) => ({ position: "fixed", inset: 0, background: "rgba(5,6,8,.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: m ? "flex-end" : "flex-start", justifyContent: "center", paddingTop: m ? 0 : "10vh", zIndex: 100 });
const paletteBox = (m) => ({ width: "100%", maxWidth: m ? "100%" : 560, background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: m ? "18px 18px 0 0" : 14, boxShadow: "0 40px 120px -10px rgba(0,0,0,.7)", overflow: "hidden", maxHeight: m ? "85dvh" : "auto" });
const drawer = (m) => ({ width: "100%", maxWidth: m ? "100%" : 420, height: m ? "auto" : "auto", maxHeight: m ? "88dvh" : "82vh", overflowY: "auto", background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: m ? "18px 18px 0 0" : 16, padding: 22, boxShadow: "0 40px 120px -10px rgba(0,0,0,.7)", marginTop: m ? "auto" : 0 });
const palHdr = { fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--dim)", textTransform: "uppercase", letterSpacing: 1, padding: "8px 12px 4px" };
const palRow = (on) => ({ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: on ? "var(--sel)" : "transparent" });
const deadTag = { marginTop: 12, background: SEM.red + "1a", color: SEM.red, border: `1px solid ${SEM.red}44`, borderRadius: 8, padding: "7px 11px", fontSize: 12.5 };
const swipeReveal = { position: "absolute", right: 0, top: 0, bottom: 0, width: 120, background: SEM.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 };
const toastStyle = { position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "var(--accent-ink)", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 10, zIndex: 120, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 12px 30px -8px rgba(0,0,0,.4)" };
const toastUndo = { background: "var(--accent-ink)", color: "var(--accent)", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)" };
const code = { fontFamily: "var(--mono)", fontSize: 11.5, background: "var(--panel2)", padding: "1px 5px", borderRadius: 4, color: "var(--text)" };
const hint = { textAlign: "center", color: "var(--dim)", fontSize: 13, marginTop: 18, lineHeight: 1.7, maxWidth: 720, marginLeft: "auto", marginRight: "auto" };
