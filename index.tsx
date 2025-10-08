import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Include Tailwind styles via PostCSS build
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hard safety: if someone lands on the site root with ?id=, push to /feedback
try {
  const params = new URLSearchParams(window.location.search);
  const hasId = params.has("id");
  const base = (import.meta as any).env?.BASE_URL || "/";
  const feedbackPath = (base.endsWith("/") ? base : base + "/") + "feedback";
  const atBaseRoot =
    window.location.pathname === base ||
    window.location.pathname === base.replace(/\/$/, "");
  if (hasId && atBaseRoot) {
    window.history.replaceState({}, "", feedbackPath + window.location.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
} catch {}
