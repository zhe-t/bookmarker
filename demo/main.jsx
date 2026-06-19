// Demo entry: install the mock chrome.* layer BEFORE anything that touches it,
// then mount the real dashboard with the real stylesheets.
import "./mock-chrome.js";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../src/newtab/App.jsx";
import "../src/styles.css";
import "../src/enhancements.css";

createRoot(document.getElementById("root")).render(<App />);
