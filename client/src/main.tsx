import React, { Component, lazy, Suspense, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "highlight.js/styles/github-dark.css";

const ProductTour = lazy(() => import("./pages/ProductTour"));

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
            A connected place for your team's work.
          </h1>
          <p className="my-4">
            Plan projects, share context and review progress together. The
            interactive preview could not load.
          </p>
          <a href="/tour" className="mr-6 underline">
            Reload preview
          </a>
          <a href="/" className="underline">
            Open the app
          </a>
        </main>
      );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/, "") === "/tour" ? (
      <TourErrorBoundary>
        <Suspense
          fallback={
            <main className="min-h-screen p-8" role="status">
              <h1 className="text-3xl font-bold">
                A connected place for your team’s work.
              </h1>
              <p className="my-4">Loading the product tour…</p>
              <a className="underline" href="/">
                Open the app
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
