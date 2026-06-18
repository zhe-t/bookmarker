import React, { useState } from "react";

// Chrome's _favicon API (MV3, needs the "favicon" permission). Falls back to a
// deterministic colored initial when the favicon is missing or we're outside
// an extension context.
const faviconUrl = (pageUrl) => {
  try {
    if (!chrome?.runtime?.getURL) return null;
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=64`);
  } catch {
    return null;
  }
};

export function Favicon({ b, size = 34 }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : faviconUrl(b.url);
  const dim = { width: size, height: size, fontSize: size * 0.4 };
  if (src) {
    return (
      <div className="favicon favicon--img" style={dim}>
        <img src={src} alt="" width={Math.round(size * 0.53)} height={Math.round(size * 0.53)}
          onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className="favicon" style={{ ...dim, background: b.color }}>
      {(b.domain[0] || "?").toUpperCase()}
    </div>
  );
}
