import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  History,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import "./access.css";
import "./console.css";

export type ConsoleSection = "workspaces" | "activity" | "security";

const sections = [
  { id: "workspaces", label: "Workspaces", icon: Building2 },
  { id: "activity", label: "Activity", icon: History },
  { id: "security", label: "Account security", icon: ShieldCheck },
] as const;

export function ConsoleShell({
  section,
  onSectionChange,
  operator,
  onLogout,
  busy,
  children,
}: {
  section: ConsoleSection;
  onSectionChange: (section: ConsoleSection) => void;
  operator: { name: string; email: string } | null;
  onLogout: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ez-access ez-console">
      <a className="ez-console-skip" href="#console-main">
        Skip to content
      </a>
      <aside className="ez-console-sidebar" aria-label="Operator console">
        <a href="/" className="ez-console-brand">
          <img src="/brand/ez-logo-64.png" width="38" height="38" alt="" />
          <span>
            {BRAND.name}
            <small>Operator console</small>
          </span>
        </a>
        <p className="ez-console-nav-label">Platform management</p>
        <nav className="ez-console-nav" aria-label="Console navigation">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              onClick={() => onSectionChange(id)}
              disabled={busy}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="ez-console-sidebar-bottom">
          <div className="ez-console-operator">
            <span className="ez-console-operator-avatar" aria-hidden="true">
              {(operator?.name || operator?.email || "O")
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <div>
              <strong>{operator?.name || "Operator"}</strong>
              <small>{operator?.email}</small>
            </div>
          </div>
          <button
            type="button"
            className="ez-console-logout"
            onClick={onLogout}
            disabled={busy}
          >
            <LogOut size={17} aria-hidden="true" /> Log out
          </button>
        </div>
      </aside>
      <div className="ez-console-main">
        <header className="ez-console-topbar">
          <div className="ez-console-breadcrumb">
            <span>Console</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{sections.find((item) => item.id === section)?.label}</span>
          </div>
          <a href="/">
            View website <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </header>
        <main id="console-main" className="ez-console-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="ez-console-footer">
          E-Z by AFK³ Solutions <span>Skip the basic.</span>
        </footer>
      </div>
    </div>
  );
}
