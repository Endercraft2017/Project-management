/**
 * User Menu
 * Avatar dropdown holding identity, appearance preferences, admin settings,
 * and sign out, so the top bar stays uncluttered.
 */

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, LogOut, Monitor, Moon, Settings, Sparkles, Sun } from 'lucide-react';
import api from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';
import { useThemeStore, type Theme } from '@/store/themeStore';
import { useUiStore } from '@/store/uiStore';
import type { User } from '@/types';

interface UserMenuProps {
  user: User;
  onOpenSettings?: () => void;
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const itemClass =
  'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-foreground/[0.07]';

export function Avatar({ user, className }: { user: Pick<User, 'name' | 'picture'>; className?: string }) {
  return user.picture ? (
    <img
      src={user.picture}
      alt=""
      referrerPolicy="no-referrer"
      className={cn('h-8 w-8 rounded-full object-cover ring-2 ring-white/60 dark:ring-white/10', className)}
    />
  ) : (
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary',
        className
      )}
    >
      {getInitials(user.name)}
    </div>
  );
}

// The server only accepts POST for logout (a GET link would not end the session)
async function signOut() {
  try {
    await api.post('/api/auth/logout');
  } catch (error) {
    console.error('Sign out failed:', error);
  } finally {
    window.location.assign('/');
  }
}

export default function UserMenu({ user, onOpenSettings }: UserMenuProps) {
  const { theme, setTheme } = useThemeStore();
  const { ambientMotion, setAmbientMotion } = useUiStore();
  const roleLabel = user.role === 'ADMIN' ? 'Admin' : 'Member';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex items-center gap-2 rounded-full p-1 pr-2 outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring sm:pr-3"
        aria-label="Account menu"
      >
        <Avatar user={user} />
        <div className="hidden text-left md:block">
          <p className="max-w-32 truncate text-sm font-medium leading-tight">{user.name}</p>
          <p className="text-xs leading-tight text-muted-foreground">{roleLabel}</p>
        </div>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="glass z-50 w-64 rounded-2xl p-1.5 text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar user={user} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-foreground/10" />

          <DropdownMenu.Label className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className={itemClass}
                onSelect={(e) => e.preventDefault()}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="h-4 w-4 text-primary" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.CheckboxItem
            checked={ambientMotion}
            onCheckedChange={(checked) => setAmbientMotion(checked === true)}
            onSelect={(e) => e.preventDefault()}
            className={itemClass}
          >
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Animated background</span>
            <span
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                ambientMotion ? 'bg-primary' : 'bg-foreground/15'
              )}
              aria-hidden
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  ambientMotion ? 'translate-x-[18px]' : 'translate-x-0.5'
                )}
              />
            </span>
          </DropdownMenu.CheckboxItem>

          {onOpenSettings && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-foreground/10" />
              <DropdownMenu.Item className={itemClass} onSelect={onOpenSettings}>
                <Settings className="h-4 w-4 text-muted-foreground" />
                Admin settings
              </DropdownMenu.Item>
            </>
          )}

          <DropdownMenu.Separator className="my-1 h-px bg-foreground/10" />
          <DropdownMenu.Item className={cn(itemClass, 'text-destructive')} onSelect={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
