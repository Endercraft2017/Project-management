/**
 * Summary Content Component
 * Displays summaries grouped by impact level
 */

import { TrendingUp, Zap, FileText } from 'lucide-react';
import type { GroupedWeeklySummary } from '@/types';
import SummaryCard from './SummaryCard';

interface SummaryContentProps {
  summary: GroupedWeeklySummary;
}

export default function SummaryContent({ summary }: SummaryContentProps) {
  // Defensive null checks for all required data
  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground">
            Unable to display summary data. Please try generating a new summary.
          </p>
        </div>
      </div>
    );
  }

  const { grouped, stats } = summary;

  // Guard against malformed data - comprehensive validation
  if (
    !grouped ||
    !stats ||
    typeof grouped !== 'object' ||
    typeof stats !== 'object' ||
    !Array.isArray(grouped.high) ||
    !Array.isArray(grouped.medium) ||
    !Array.isArray(grouped.low) ||
    typeof stats.total !== 'number' ||
    typeof stats.high !== 'number' ||
    typeof stats.medium !== 'number' ||
    typeof stats.low !== 'number'
  ) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-muted-foreground">
            Unable to display summary data. The data structure is invalid.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Please try regenerating the summary or contact support if the issue persists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                High Impact
              </p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
                {stats.high}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-500" />
          </div>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Medium Impact
              </p>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                {stats.medium}
              </p>
            </div>
            <Zap className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4">
          <div className="flex items-center justify-center">
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Low Impact
              </p>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100 mt-1">
                {stats.low}
              </p>
            </div>
            <FileText className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>
        </div>
      </div>

      {/* High Impact Section */}
      {grouped.high && grouped.high.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <h3 className="text-lg font-semibold">High Impact Updates</h3>
            <span className="text-sm text-muted-foreground">
              ({grouped.high.length} member{grouped.high.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="space-y-3">
            {grouped.high.map((memberSummary) => (
              <SummaryCard key={memberSummary.id} summary={memberSummary} />
            ))}
          </div>
        </section>
      )}

      {/* Medium Impact Section */}
      {grouped.medium && grouped.medium.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <h3 className="text-lg font-semibold">Medium Impact Updates</h3>
            <span className="text-sm text-muted-foreground">
              ({grouped.medium.length} member{grouped.medium.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="space-y-3">
            {grouped.medium.map((memberSummary) => (
              <SummaryCard key={memberSummary.id} summary={memberSummary} />
            ))}
          </div>
        </section>
      )}

      {/* Low Impact Section */}
      {grouped.low && grouped.low.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <h3 className="text-lg font-semibold">Low Impact Updates</h3>
            <span className="text-sm text-muted-foreground">
              ({grouped.low.length} member{grouped.low.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="space-y-3">
            {grouped.low.map((memberSummary) => (
              <SummaryCard key={memberSummary.id} summary={memberSummary} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {stats.total === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No team updates were submitted this week.
          </p>
        </div>
      )}

      {/* AI Attribution */}
      <div className="text-center text-xs text-muted-foreground pt-6 border-t border-border">
        <p>
          Summaries generated using AI (OpenAI GPT-3.5 Turbo) to help you stay
          informed about your team's progress.
        </p>
      </div>
    </div>
  );
}
