/**
 * Week List Component
 * Sidebar list of available weekly summaries
 */

import { Calendar, ChevronRight } from 'lucide-react';
import type { WeeklySummaryListItem } from '@/types';

interface WeekListProps {
  weeks: WeeklySummaryListItem[];
  selectedWeek: string;
  onSelectWeek: (week: string) => void;
  currentMonday: string;
}

export default function WeekList({
  weeks,
  selectedWeek,
  onSelectWeek,
  currentMonday,
}: WeekListProps) {
  const formatWeekLabel = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const monthDay = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const year = start.getFullYear();
    const currentYear = new Date().getFullYear();

    return currentYear === year ? monthDay : `${monthDay}, ${year}`;
  };

  const isCurrentWeek = (weekDate: string) => {
    return weekDate === currentMonday;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Current Week Option */}
      <button
        onClick={() => onSelectWeek(currentMonday)}
        className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent border-b border-border ${
          selectedWeek === currentMonday ? 'bg-accent' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Current Week</span>
          </div>
          {selectedWeek === currentMonday && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Past Weeks */}
      {weeks.length > 0 && (
        <div className="py-2">
          <div className="px-4 py-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Past Weeks
            </span>
          </div>

          {weeks.map((week) => {
            const weekDate = week.weekStartDate.split('T')[0];
            const isSelected = selectedWeek === weekDate;
            const isCurrent = isCurrentWeek(weekDate);

            return (
              <button
                key={week.id}
                onClick={() => onSelectWeek(weekDate)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent ${
                  isSelected ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {formatWeekLabel(week.weekStartDate, week.weekEndDate)}
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                          Now
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {week._count.memberSummaries} member
                      {week._count.memberSummaries !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {isSelected && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {weeks.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No summaries generated yet.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Admins can generate weekly summaries.
          </p>
        </div>
      )}
    </div>
  );
}
