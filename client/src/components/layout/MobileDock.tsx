/**
 * Mobile Dock
 * Floating glass dock (below the lg breakpoint) with the most-used views in
 * thumb reach; "More" opens the full navigation drawer.
 */

import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOCK_VIEWS, getNavItem, type View } from './navigation';

interface MobileDockProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onOpenMenu: () => void;
}

export default function MobileDock({ activeView, onNavigate, onOpenMenu }: MobileDockProps) {
  const inDock = DOCK_VIEWS.includes(activeView);

  const itemClass = (active: boolean) =>
    cn(
      'flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition-all duration-200',
      active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'text-foreground/70 active:scale-95'
    );

  return (
    <nav
      aria-label="Quick navigation"
      className="glass fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-3xl p-1.5 lg:hidden"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      {DOCK_VIEWS.map((view) => {
        const item = getNavItem(view);
        const Icon = item.icon;
        const active = view === activeView;
        return (
          <button
            key={view}
            onClick={() => onNavigate(view)}
            aria-current={active ? 'page' : undefined}
            className={itemClass(active)}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-[64px] truncate">{item.shortLabel ?? item.label}</span>
          </button>
        );
      })}
      <button onClick={onOpenMenu} className={itemClass(!inDock)} aria-label="More views">
        <MoreHorizontal className="h-5 w-5" />
        <span>More</span>
      </button>
    </nav>
  );
}
