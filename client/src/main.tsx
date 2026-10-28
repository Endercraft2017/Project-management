import React, { Component, lazy, Suspense, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { BRAND } from "./lib/brand";
import "./index.css";
import "highlight.js/styles/github-dark.css";

const ProductTour = lazy(() => import("./pages/ProductTour"));
const path = window.location.pathname.replace(/\/$/, "") || "/";
const parameters = new URLSearchParams(window.location.search);
// Preserve old task/update/email/OAuth links while moving the default root to marketing.
const legacyAppLink =
  path === "/" &&
  (window.location.hash.startsWith("#/") ||
    parameters.has("token") ||
    parameters.has("view") ||
    parameters.has("error"));
const showLanding = (path === "/" && !legacyAppLink) || path === "/tour";
document.title = showLanding
  ? `${BRAND.name} — ${BRAND.tagline}`
  : `${BRAND.name} Project Manager`;

// Legacy picker clients poll SDK availability on mount. Keep those libraries on app
// entries while the public landing makes no unrelated Google SDK requests.
if (!showLanding) {
  for (const [id, source] of [
    ["ez-google-api", "https://apis.google.com/js/api.js"],
    ["ez-google-identity", "https://accounts.google.com/gsi/client"],
  ]) {
    if (document.getElementById(id)) continue;
    const script = document.createElement("script");
    script.id = id;
    script.src = source;
    script.async = true;
    document.head.appendChild(script);
  }
}

class TourErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="min-h-screen p-8">
          <h1 className="text-3xl font-bold">
            {BRAND.name} — {BRAND.tagline}
          </h1>
          <p className="my-4">
            Plan projects, share context and review progress together. The
            interactive preview could not load.
          </p>
          <a href={path === "/tour" ? "/tour" : "/"} className="mr-6 underline">
            Reload preview
          </a>
          <a href={BRAND.loginPath} className="mr-6 underline">
            Log in
          </a>
          <a href={BRAND.contactURL} className="underline">
            Talk to us
          </a>
        </main>
      );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {showLanding ? (
      <TourErrorBoundary>
        <Suspense
          fallback={
            <main className="min-h-screen p-8" role="status">
              <h1 className="text-3xl font-bold">
                {BRAND.name} — {BRAND.tagline}
              </h1>
              <p className="my-4">Loading E-Z…</p>
              <a className="mr-6 underline" href={BRAND.loginPath}>
                Log in
              </a>
              <a className="underline" href={BRAND.contactURL}>
                Talk to us
              </a>
            </main>
          }
        >
          <ProductTour />
        </Suspense>
      </TourErrorBoundary>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
