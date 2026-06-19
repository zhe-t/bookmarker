import React from "react";

// Single-weight 1.6px stroke icon set, drawn on a 16×16 grid.
const I = ({ size = 15, children, ...rest }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children}
  </svg>
);

export const Logo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fillOpacity=".25" />
    <path d="M8 4.5 11.5 8 8 11.5 4.5 8Z" />
  </svg>
);

export const Search = (p) => <I {...p}><circle cx="7" cy="7" r="4.5" /><path d="m13.5 13.5-3.2-3.2" /></I>;
export const Command = (p) => <I {...p}><path d="M6 6h4v4H6Z M6 6H4.5A1.5 1.5 0 1 1 6 4.5Z M10 6h1.5A1.5 1.5 0 1 0 10 4.5Z M6 10H4.5A1.5 1.5 0 1 0 6 11.5Z M10 10h1.5a1.5 1.5 0 1 1-1.5 1.5Z" /></I>;
export const Sun = (p) => <I {...p}><circle cx="8" cy="8" r="3.2" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" /></I>;
export const Moon = (p) => <I {...p}><path d="M13.5 9.5A5.8 5.8 0 0 1 6.5 2.5a5.8 5.8 0 1 0 7 7Z" /></I>;
export const Import = (p) => <I {...p}><path d="M8 2v7.5M5 7l3 3 3-3" /><path d="M2.5 11v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" /></I>;
export const Export = (p) => <I {...p}><path d="M8 9.5V2M5 4.5l3-3 3 3" /><path d="M2.5 11v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" /></I>;
export const Check = (p) => <I {...p}><path d="m3 8.5 3.2 3.2L13 5" /></I>;
export const X = (p) => <I {...p}><path d="m4 4 8 8M12 4l-8 8" /></I>;
export const Trash = (p) => <I {...p}><path d="M2.5 4h11M5.5 4V2.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" /></I>;
export const Archive = (p) => <I {...p}><rect x="2" y="2.5" width="12" height="3.5" rx=".8" /><path d="M3.2 6v6.5a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V6M6.4 9h3.2" /></I>;
export const Restore = (p) => <I {...p}><path d="M2.5 6.5A5.7 5.7 0 1 1 2.3 9" /><path d="M2.5 2.5v4h4" /></I>;
export const Scan = (p) => <I {...p}><path d="M8 2.2A5.8 5.8 0 1 1 2.2 8" /><path d="M8 5v3.2l2.2 1.3" /></I>;
export const Zap = (p) => <I {...p}><path d="M8.8 1.5 3.5 9h3.7l-1 5.5L11.5 7H7.8Z" /></I>;
export const Plus = (p) => <I {...p}><path d="M8 3v10M3 8h10" /></I>;
export const Folder = (p) => <I {...p}><path d="M2 4a1 1 0 0 1 1-1h3.2l1.5 1.8H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" /></I>;
export const ChevronD = (p) => <I {...p}><path d="m4 6.5 4 4 4-4" /></I>;
export const Arrow = (p) => <I {...p}><path d="M3 8h10M9 4l4 4-4 4" /></I>;
export const Tag = (p) => <I {...p}><path d="M2 7.2V3a1 1 0 0 1 1-1h4.2a1 1 0 0 1 .7.3l6 6a1 1 0 0 1 0 1.4l-4.2 4.2a1 1 0 0 1-1.4 0l-6-6A1 1 0 0 1 2 7.2Z" /><circle cx="5.5" cy="5.5" r=".4" fill="currentColor" /></I>;
export const Circle = (p) => <I {...p}><circle cx="8" cy="8" r="5.8" strokeDasharray="2 3.2" /></I>;
export const Dots = (p) => <I {...p}><circle cx="3" cy="8" r=".9" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" /><circle cx="13" cy="8" r=".9" fill="currentColor" stroke="none" /></I>;
export const Pencil = (p) => <I {...p}><path d="M9.5 3.2 12.8 6.5 5.6 13.7l-3.8.5.5-3.8Z" /><path d="m11.2 1.5 3.3 3.3" /></I>;
export const Link = (p) => <I {...p}><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.4-2.4a3 3 0 0 0-4.2-4.2l-1.2 1.2" /><path d="M9.5 6.5a3 3 0 0 0-4.2 0L2.9 8.9a3 3 0 0 0 4.2 4.2l1.2-1.2" /></I>;
export const Copy = (p) => <I {...p}><rect x="5.5" y="5.5" width="8" height="8" rx="1.2" /><path d="M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8" /></I>;
export const Clipboard = (p) => <I {...p}><rect x="3.5" y="3" width="9" height="11" rx="1.2" /><path d="M6 3V2.3a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8V3M6 3h4" /></I>;
export const External = (p) => <I {...p}><path d="M6.5 3H3.8A.8.8 0 0 0 3 3.8v8.4a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V9.5" /><path d="M9.5 2.5H13.5V6.5M13.2 2.8 7.5 8.5" /></I>;
export const Question = (p) => <I {...p}><circle cx="8" cy="8" r="5.8" /><path d="M6.2 6.2a1.8 1.8 0 1 1 2.6 1.7c-.6.3-.8.7-.8 1.3" /><circle cx="8" cy="11.2" r=".5" fill="currentColor" stroke="none" /></I>;
export const Pin = (p) => <I {...p}><path d="M9.8 1.8 14.2 6.2 11.7 7l-2.3 2.3-.3 3-1.6-1.6-3.4 3.4M6.9 8.6 3.5 5.2 6.5 4.3 9.8 1.8" /></I>;
export const PinFilled = ({ size = 15, ...rest }) => (
  <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" {...rest}>
    <path d="M9.8 1.8 14.2 6.2 11.7 7l-2.3 2.3-.4 3.1L4 7.7l3.1-.4L9.8 1.8Z" />
    <path d="M7.4 8.6 3.5 12.5" fill="none" strokeLinecap="round" />
  </svg>
);
export const Rows = (p) => <I {...p}><path d="M2.5 4h11M2.5 8h11M2.5 12h11" /></I>;
export const Sliders = (p) => <I {...p}><path d="M2.5 5h7M12 5h1.5M2.5 11h1.5M7 11h6.5" /><circle cx="10.5" cy="5" r="1.6" /><circle cx="5" cy="11" r="1.6" /></I>;
export const Clock = (p) => <I {...p}><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.3 1.4" /></I>;
export const Note = (p) => <I {...p}><path d="M3 2.5h7.5L13 5v8.5H3Z" /><path d="M10.3 2.5V5H13M5.2 8h5.6M5.2 10.5h3.6" /></I>;
export const Swatch = (p) => <I {...p}><circle cx="8" cy="8" r="5.8" /><circle cx="8" cy="8" r="2.2" /></I>;
export const Bars = (p) => <I {...p}><path d="M2.5 13.5h11" /><rect x="3.2" y="8" width="2.6" height="4" rx=".5" /><rect x="6.7" y="5" width="2.6" height="7" rx=".5" /><rect x="10.2" y="9.5" width="2.6" height="2.5" rx=".5" /></I>;
export const Sync = (p) => <I {...p}><path d="M13 7a5 5 0 0 0-8.6-2.6L2.5 6" /><path d="M3 9a5 5 0 0 0 8.6 2.6L13.5 10" /><path d="M2.5 3v3h3M13.5 13v-3h-3" /></I>;
export const Tree = (p) => <I {...p}><path d="M4 3h8M4 3v9M4 7.5h4M4 11.5h4" /></I>;
export const Grid = (p) => <I {...p}><rect x="2.3" y="2.3" width="4.7" height="4.7" rx="1" /><rect x="9" y="2.3" width="4.7" height="4.7" rx="1" /><rect x="2.3" y="9" width="4.7" height="4.7" rx="1" /><rect x="9" y="9" width="4.7" height="4.7" rx="1" /></I>;
