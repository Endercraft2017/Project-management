/**
 * Summary Card Component
 * Individual member summary with impact indicator
 */

import { User, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { MemberWeeklySummary, ImpactLevel } from '@/types';

interface SummaryCardProps {
  summary: MemberWeeklySummary;
}

const IMPACT_COLORS: Record<ImpactLevel, { border: string; bg: string; dot: string; text: string }> = {
  HIGH: {
    border: 'border-green-200 dark:border-green-900',
    bg: 'bg-green-50 dark:bg-green-950/10',
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
  },
  MEDIUM: {
    border: 'border-yellow-200 dark:border-yellow-900',
    bg: 'bg-yellow-50 dark:bg-yellow-950/10',
    dot: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  LOW: {
    border: 'border-red-200 dark:border-red-900',
    bg: 'bg-red-50 dark:bg-red-950/10',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
  },
};

export default function SummaryCard({ summary }: SummaryCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const colors = IMPACT_COLORS[summary.impactLevel];

  return (
    <div
      className={`rounded-lg border ${colors.border} ${colors.bg} p-4 transition-all hover:shadow-md`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Impact Indicator Dot */}
        <div className={`h-3 w-3 rounded-full ${colors.dot} mt-1 flex-shrink-0`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Member Name */}
          <div className="flex items-center gap-2 mb-2">
            {summary.user.picture ? (
              <img
                src={summary.user.picture}
                alt={summary.user.name}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
            )}
            <h4 className="font-semibold text-foreground">{summary.user.name}</h4>
            <span className={`text-xs font-medium ${colors.text}`}>
              {summary.impactLevel}
            </span>
          </div>

          {/* AI Summary */}
          <p className="text-sm text-foreground leading-relaxed">{summary.summary}</p>

          {/* Toggle Details Button */}
          {summary.rawUpdates.updates.length > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show {summary.rawUpdates.updates.length} daily update
                  {summary.rawUpdates.updates.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}

          {/* Expanded Details */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
              {/* Impact Reasoning */}
              <div className="text-xs">
                <span className="font-medium text-foreground">AI Assessment: </span>
                <span className="text-muted-foreground">
                  {summary.rawUpdates.reasoning}
                </span>
              </div>

              {/* Raw Updates */}
              <div>
                <h5 className="text-xs font-medium text-foreground mb-2">
                  Daily Updates:
                </h5>
                <div className="space-y-2">
                  {summary.rawUpdates.updates.map((update, index) => (
                    <div
                      key={index}
                      className="text-xs bg-background/50 rounded p-2 border border-border/30"
                    >
                      <div className="font-medium text-muted-foreground mb-1">
                        {new Date(update.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-foreground">{update.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
