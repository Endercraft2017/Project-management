/**
 * Day List Component - Shows list of days with updates
 */

import { Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayListProps {
  days: Date[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  highlightMissingDates?: string[];
}

export default function DayList({ days, selectedDate, onSelectDate, highlightMissingDates = [] }: DayListProps) {
  const today = new Date().toISOString().split('T')[0];

  // Always include today in the list
  const allDays = new Set([today, ...days.map(d => new Date(d).toISOString().split('T')[0])]);
  const sortedDays = Array.from(allDays).sort((a, b) => b.localeCompare(a)); // Newest first

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today) {
      return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      // Format as "January 15, 2025"
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 space-y-1">
        {sortedDays.map((dateStr) => {
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const needsUpdate = highlightMissingDates.includes(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'font-medium truncate flex items-center gap-2',
                  isToday && !isSelected && 'text-primary'
                )}>
                  <span>{formatDateLabel(dateStr)}</span>
                  {needsUpdate && (
                    <AlertCircle className={cn(
                      'h-4 w-4 flex-shrink-0 animate-pulse',
                      isSelected ? 'text-primary-foreground' : 'text-orange-500'
                    )} />
                  )}
                </div>
                <div className={cn(
                  'text-xs',
                  isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {formatDateShort(dateStr)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
