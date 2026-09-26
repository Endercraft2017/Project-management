/**
 * Top Bar
 * Shows where you are (view title + purpose) on the left and global actions
 * (notifications, invite, account) on the right.
 *
 * The glass lives on a sibling backdrop layer rather than the header itself:
 * backdrop-filter would otherwise trap the notification panel's fixed
 * positioning inside the bar.
 */

import type { ReactNode } from 'react';
import { Menu, UserPlus } from 'lucide-react';
import type { NavItem } from './navigation';

interface TopbarProps {
  current: NavItem;
  onOpenMenu: () => void;
  onInvite?: () => void;
  notifications: ReactNode;
  userMenu: ReactNode;
}

export default function Topbar({ current, onOpenMenu, onInvite, notifications, userMenu }: TopbarProps) {
  const Icon = current.icon;

  return (
    <header className="relative shrink-0 rounded-3xl">
      <div aria-hidden className="glass pointer-events-none absolute inset-0 rounded-3xl" />
      <div className="relative flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          onClick={onOpenMenu}
          className="rounded-xl p-2 text-foreground/80 transition-colors hover:bg-foreground/[0.06] lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{current.label}</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{current.description}</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {notifications}
          {onInvite && (
            <button
              onClick={onInvite}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.03] hover:bg-primary/90 active:scale-100 sm:px-4"
              title="Invite members"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden md:inline">Invite</span>
            </button>
          )}
          <div className="mx-1 hidden h-6 w-px bg-foreground/10 sm:block" />
          {userMenu}
        </div>
      </div>
    </header>
  );
}
