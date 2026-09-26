/**
 * Weekly Summaries View Component
 * Displays AI-powered weekly team summaries with impact assessments
 */

import { useState } from 'react';
import { useGroupedWeeklySummary, useWeeklySummaries } from '@/hooks/useSummaries';
import { TrendingUp, Calendar, Sparkles } from 'lucide-react';
import WeekList from './WeekList';
import SummaryContent from './SummaryContent';
import GenerateSummaryButton from './GenerateSummaryButton';
import SendEmailButton from './SendEmailButton';
import DeleteSummaryButton from './DeleteSummaryButton';
import { useCurrentUser } from '@/hooks/useUsers';

export default function WeeklySummariesView() {
  // Get current week's Monday
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return monday.toISOString().split('T')[0];
  };

  const today = new Date();
  const currentMonday = getMonday(today);

  const [selectedWeek, setSelectedWeek] = useState<string>(currentMonday);
  const { data: weeks } = useWeeklySummaries();
  const { data: summary, isLoading, error } = useGroupedWeeklySummary(selectedWeek);
  const { data: currentUser } = useCurrentUser();

  const isAdmin = currentUser?.role === 'ADMIN';

  // Handle summary deletion - switch to current week if deleted week was selected
  const handleDeleted = () => {
    if (selectedWeek !== currentMonday) {
      setSelectedWeek(currentMonday);
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startFormatted = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const endFormatted = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return `${startFormatted} - ${endFormatted}`;
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Week List */}
      <div className="w-64 border-r border-border bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Weekly Summaries</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered team insights
            </p>
          </div>

          {/* Week List */}
          <WeekList
            weeks={weeks?.summaries || []}
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
            currentMonday={currentMonday}
          />
        </div>
      </div>

      {/* Main Content - Summary Display */}
      <div className="flex-1 flex flex-col">
        {/* Header with Actions */}
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              {summary ? (
                <>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    {formatDateRange(summary.weekStartDate, summary.weekEndDate)}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generated {new Date(summary.generatedAt).toLocaleString()}
                    {summary.emailSentAt && (
                      <span className="ml-2 text-green-600">
                        • Email sent {new Date(summary.emailSentAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    {formatDateRange(
                      selectedWeek,
                      new Date(
                        new Date(selectedWeek).getTime() + 6 * 24 * 60 * 60 * 1000
                      ).toISOString().split('T')[0]
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    No summary generated yet
                  </p>
                </>
              )}
            </div>

            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                {summary && (
                  <>
                    <SendEmailButton weekDate={selectedWeek} />
                    <DeleteSummaryButton
                      summaryId={summary.id}
                      weekDate={selectedWeek}
                      onDeleted={handleDeleted}
                    />
                  </>
                )}
                <GenerateSummaryButton weekDate={selectedWeek} />
              </div>
            )}
          </div>
        </div>

        {/* Summary Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Sparkles className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
                <p className="text-muted-foreground">Loading summary...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center max-w-md">
                <p className="text-muted-foreground mb-4">
                  No summary available for this week yet.
                </p>
                {isAdmin && (
                  <p className="text-sm text-muted-foreground">
                    Click "Generate Summary" to create one.
                  </p>
                )}
              </div>
            </div>
          ) : summary ? (
            <SummaryContent summary={summary} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
