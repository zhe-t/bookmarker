import { useEffect, useState } from "react";

// Call onAway when a pointerdown lands outside ref. Active flag avoids a
// document listener per closed popover.
export function useClickAway(ref, onAway, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onAway(); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [active, ref, onAway]);
}

// True while the element can still scroll further down. Tracks scroll events,
// element resize, and any deps that change the content height.
export function useScrollHint(ref, deps = []) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) { setMore(false); return; }
    // threshold > the 5px row-in translate, which briefly inflates scrollHeight
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    check();
    // re-check once the staggered entrance animations have settled
    const settle = setTimeout(check, 750);
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { clearTimeout(settle); el.removeEventListener("scroll", check); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return more;
}
