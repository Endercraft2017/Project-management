/**
 * App navigation model
 * Views are grouped and ordered by how work flows through the team:
 * see progress -> plan and track work -> collaborate on it -> report on it.
 */

import {
  LayoutDashboard,
  CheckSquare,
  GanttChartSquare,
  MessageSquare,
  FileText,
  StickyNote,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type View =
  | 'dashboard'
  | 'tasks'
  | 'gantt'
  | 'chat'
  | 'updates'
  | 'notes'
  | 'summaries'
  | 'team';

export interface NavItem {
  id: View;
  label: string;
  /** Compact label for the mobile dock */
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'Progress, workload, and trends at a glance',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Plan & track',
    items: [
      { id: 'tasks', label: 'Tasks', description: 'Plan, assign, and track work', icon: CheckSquare },
      {
        id: 'gantt',
        label: 'Gantt',
        description: 'Schedule and timelines across sprints',
        icon: GanttChartSquare,
      },
    ],
  },
  {
    label: 'Collaborate',
    items: [
      { id: 'chat', label: 'Chat', description: 'Conversations with your team', icon: MessageSquare },
      {
        id: 'updates',
        label: 'Daily updates',
        shortLabel: 'Updates',
        description: 'What everyone worked on each day',
        icon: FileText,
      },
      { id: 'notes', label: 'Notes', description: 'Personal notes and reminders', icon: StickyNote },
    ],
  },
  {
    label: 'Report',
    items: [
      {
        id: 'summaries',
        label: 'Weekly summaries',
        description: 'AI-generated weekly recaps',
        icon: TrendingUp,
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        id: 'team',
        label: 'Team',
        description: 'Members and pending invitations',
        icon: Users,
        adminOnly: true,
      },
    ],
  },
];

/** Primary destinations shown in the mobile dock (thumb reach). */
export const DOCK_VIEWS: View[] = ['dashboard', 'tasks', 'chat', 'updates'];

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export function getNavItem(view: View): NavItem {
  return ALL_ITEMS.find((item) => item.id === view) ?? ALL_ITEMS[0];
}

export function visibleSections(isAdmin: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isAdmin || !item.adminOnly),
  })).filter((section) => section.items.length > 0);
}

export function isView(value: string): value is View {
  return ALL_ITEMS.some((item) => item.id === value);
}
