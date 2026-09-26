/**
 * Missing Updates Settings Tab
 * Configuration for missing updates tracking (without member selection)
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useMissingUpdatesConfig, useUpdateMissingUpdatesConfig } from '@/hooks/useMissingUpdates';
import { useToast } from '@/hooks/useToast';
import type { DateRangeType } from '@/types';

export default function MissingUpdatesTab() {
  const { toast } = useToast();
  const { data: config, isLoading } = useMissingUpdatesConfig();
  const updateConfig = useUpdateMissingUpdatesConfig();

  const [checkBusinessDaysOnly, setCheckBusinessDaysOnly] = useState(true);
  const [defaultDateRange, setDefaultDateRange] = useState<DateRangeType>('current_week');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with config data
  useEffect(() => {
    if (config) {
      setCheckBusinessDaysOnly(config.checkBusinessDaysOnly);
      setDefaultDateRange(config.defaultDateRange);
    }
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig.mutateAsync({
        enabled: true,
        checkBusinessDaysOnly,
        defaultDateRange,
        includedUserIds: [], // Will be read from weekly summary members config
      });

      toast({
        title: 'Settings Updated',
        description: 'Missing updates configuration has been saved successfully',
        variant: 'success',
      });
    } catch (error: unknown) {
      toast({
        title: 'Update Failed',
        description: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasChanges = config && (
    config.checkBusinessDaysOnly !== checkBusinessDaysOnly ||
    config.defaultDateRange !== defaultDateRange
  );

  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Missing Updates Tracking</h3>
        <p className="text-sm text-muted-foreground">
          Configure how the system checks for missing daily updates. The selected team members from the "Team Members" tab will be tracked.
        </p>
      </div>

      {/* Business Days Only */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative flex items-center justify-center pt-0.5">
            <input
              type="checkbox"
              checked={checkBusinessDaysOnly}
              onChange={(e) => setCheckBusinessDaysOnly(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                checkBusinessDaysOnly
                  ? 'bg-primary border-primary'
                  : 'border-border bg-background'
              }`}
            >
              {checkBusinessDaysOnly && (
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Business Days Only (Monday-Friday)</div>
            <div className="text-xs text-muted-foreground mt-1">
              Only check for missing updates on weekdays. Weekends will be excluded.
            </div>
          </div>
        </label>
      </div>

      {/* Default Date Range */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Default Date Range</label>
        <p className="text-xs text-muted-foreground">
          The default time period to check for missing updates when opening the tracker.
        </p>
        <select
          value={defaultDateRange}
          onChange={(e) => setDefaultDateRange(e.target.value as DateRangeType)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="current_week">Current Week (Monday - Today)</option>
          <option value="last_7_days">Last 7 Days</option>
          <option value="last_14_days">Last 14 Days</option>
          <option value="last_30_days">Last 30 Days</option>
        </select>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 <strong>Tip:</strong> Use the "Team Members" tab to select which members should be tracked for missing updates.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
