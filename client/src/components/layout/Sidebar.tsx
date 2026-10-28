/**
 * Sidebar Navigation
 * Desktop: floating glass panel that collapses to an icon rail.
 * Mobile: slide-in drawer opened from the top bar or the dock's "More" button.
 */

import { useEffect, useRef } from 'react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { visibleSections, type View } from './navigation';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  isAdmin: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function Brand({ compact }: { compact: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 px-2', compact && 'justify-center px-0')}>
      <img src="/brand/ez-logo-64.png" width="36" height="36" alt={compact ? BRAND.name : ''} className="h-9 w-9 shrink-0 object-contain" />
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{BRAND.name}</p>
          <p className="truncate text-xs text-muted-foreground">{BRAND.tagline}</p>
        </div>
      )}
    </div>
  );
}

function NavList({
  activeView,
  onNavigate,
  isAdmin,
  compact,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  isAdmin: boolean;
  compact: boolean;
}) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {visibleSections(isAdmin).map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          {compact ? (
            <div className="mx-auto mb-1 h-px w-6 bg-foreground/10 first:hidden" />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={compact ? item.label : undefined}
                title={compact ? item.label : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  compact && 'justify-center px-0',
                  active
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-foreground/75 hover:bg-foreground/[0.06] hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-transform duration-200',
                    !active && 'group-hover:scale-110'
                  )}
                />
                {!compact && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar({
  activeView,
  onNavigate,
  isAdmin,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const drawerRef = useRef<HTMLElement>(null);

  // Keep the closed drawer out of the tab order (React 18 has no `inert` prop)
  useEffect(() => {
    drawerRef.current?.toggleAttribute('inert', !mobileOpen);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onMobileClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onMobileClose]);

  const navigate = (view: View) => {
    onNavigate(view);
    onMobileClose();
  };

  return (
    <>
      {/* Desktop rail / panel */}
      <aside
        className={cn(
          'glass hidden shrink-0 flex-col rounded-3xl p-3 transition-[width] duration-300 ease-out lg:flex',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className="py-2">
          <Brand compact={collapsed} />
        </div>
        <div className="mt-4 flex-1 overflow-y-auto overflow-x-hidden">
          <NavList activeView={activeView} onNavigate={onNavigate} isAdmin={isAdmin} compact={collapsed} />
        </div>
        <button
          onClick={onToggleCollapsed}
          className={cn(
            'mt-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
            collapsed && 'justify-center px-0'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onMobileClose}
        aria-hidden
      />
      <aside
        className={cn(
          'glass fixed inset-y-3 left-3 z-50 flex w-72 flex-col rounded-3xl p-3 transition-transform duration-300 ease-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
        )}
        ref={drawerRef}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between py-2">
          <Brand compact={false} />
          <button
            onClick={onMobileClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto">
          <NavList activeView={activeView} onNavigate={navigate} isAdmin={isAdmin} compact={false} />
        </div>
      </aside>
    </>
  );
}
