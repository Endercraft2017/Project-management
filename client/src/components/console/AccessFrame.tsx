import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import "./access.css";

export function AccessFrame({
  title,
  eyebrow,
  children,
  wide = false,
  actions,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  wide?: boolean;
  actions?: ReactNode;
}) {
  return (
    <main className={`ez-access ${wide ? "ez-access--wide" : ""}`}>
      <header className="ez-access-header">
        <a href="/" className="ez-access-brand" aria-label="E-Z home">
          <img src="/brand/ez-logo-64.png" width="42" height="42" alt="" />
          <span>
            {BRAND.name}
            <small>{BRAND.tagline}</small>
          </span>
        </a>
        <nav aria-label="Account navigation">
          {actions || <a href={BRAND.contactURL}>Talk to us</a>}
        </nav>
      </header>
      <section className="ez-access-content">
        <p className="ez-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
      <footer className="ez-access-footer">
        <span>{BRAND.name} by AFK³ Solutions</span>
        <a href="/">Back to the website</a>
      </footer>
    </main>
  );
}
export function Notice({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <p
      className={`ez-notice ${success ? "ez-notice--success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {children}
    </p>
  );
}
