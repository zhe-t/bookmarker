import React, { useEffect, useRef, useState } from "react";

const TO = "zhe@solworks.dev";

// Collects a short note and hands it off to the user's mail client via a
// prefilled mailto:. No backend — the draft opens addressed and populated.
export function FeedbackModal({ onClose }) {
  const [text, setText] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const send = (e) => {
    e.preventDefault();
    const body = encodeURIComponent(text.trim());
    const subject = encodeURIComponent("Bookmarker feedback");
    window.open(`mailto:${TO}?subject=${subject}&body=${body}`, "_blank");
    onClose();
  };

  return (
    <form className="form" onSubmit={send}>
      <div className="form-title">Send feedback</div>
      <label className="field">
        <span className="field-label">Your feedback <em>opens in your mail app</em></span>
        <textarea ref={ref} className="text-input field-input feedback-area" value={text}
          onChange={(e) => setText(e.target.value)} rows={5}
          placeholder="What's working, what's broken, what you'd love to see…" />
      </label>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={!text.trim()}>Send feedback</button>
      </div>
    </form>
  );
}
