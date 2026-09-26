/**
 * Missing Updates Configuration Component
 * Admin interface for configuring missing updates tracking
 */

import { useState, useEffect } from 'react';
import { useMissingUpdatesConfig, useUpdateMissingUpdatesConfig } from '@/hooks/useMissingUpdates';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/hooks/useToast';
import { Loader2, Save, Users, X } from 'lucide-react';
import type { MissingUpdatesConfig, DateRangeType } from '@/types';

interface MissingUpdatesConfigCardProps {
  onClose?: () => void;
}

export function MissingUpdatesConfigCard({ onClose }: MissingUpdatesConfigCardProps = {}) {
  const { toast } = useToast();
  const { data: config, isLoading } = useMissingUpdatesConfig();
  const { data: usersData } = useUsers();
  const updateConfig = useUpdateMissingUpdatesConfig();

  const [enabled, setEnabled] = useState(false);
  const [checkBusinessDaysOnly, setCheckBusinessDaysOnly] = useState(true);
  const [defaultDateRange, setDefaultDateRange] = useState<DateRangeType>('current_week');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Initialize form with config data
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setCheckBusinessDaysOnly(config.checkBusinessDaysOnly);
      setDefaultDateRange(config.defaultDateRange);
      setSelectedUserIds(config.includedUserIds);
    }
  }, [config]);

  const handleSave = async () => {
    try {
      const newConfig: MissingUpdatesConfig = {
        enabled,
        checkBusinessDaysOnly,
        defaultDateRange,
        includedUserIds: selectedUserIds,
      };

      await updateConfig.mutateAsync(newConfig);

      toast({
        title: 'Configuration Saved',
        description: 'Missing updates settings have been updated successfully.',
        variant: 'success',
      });

      // Close dialog if callback provided
      if (onClose) {
        onClose();
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (usersData?.data?.users) {
      setSelectedUserIds(usersData.data.users.map((u) => u.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedUserIds([]);
  };

  const allUsers = usersData?.data?.users || [];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Missing Updates Tracking</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how the system tracks and notifies users about missing daily updates
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-md p-2"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="enabled" className="text-sm font-medium">
              Enable Missing Updates Tracking
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Allow admins to view and send reminders for missing updates
            </p>
          </div>
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-border"
          />
        </div>

        {/* Business Days Only */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="business-days" className="text-sm font-medium">
              Business Days Only (Mon-Fri)
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Only check for updates on weekdays, excluding weekends
            </p>
          </div>
          <input
            type="checkbox"
            id="business-days"
            checked={checkBusinessDaysOnly}
            onChange={(e) => setCheckBusinessDaysOnly(e.target.checked)}
            disabled={!enabled}
            className="rounded border-border"
          />
        </div>

        {/* Default Date Range */}
        <div className="space-y-2">
          <label htmlFor="date-range" className="block text-sm font-medium">
            Default Date Range
          </label>
          <select
            id="date-range"
            value={defaultDateRange}
            onChange={(e) => setDefaultDateRange(e.target.value as DateRangeType)}
            disabled={!enabled}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="current_week">Current Week (Mon-Today)</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_14_days">Last 14 Days</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Default time range when checking for missing updates
          </p>
        </div>

        {/* User Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Include Users
            </label>
            <div className="space-x-2">
              <button
                onClick={handleSelectAll}
                disabled={!enabled}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                disabled={!enabled}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                Deselect All
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedUserIds.length === 0
              ? 'All active users will be checked by default'
              : `${selectedUserIds.length} user(s) selected`}
          </p>

          {allUsers.length > 0 && (
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
              {allUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                >
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id)}
                    onChange={() => handleToggleUser(user.id)}
                    disabled={!enabled}
                    className="rounded border-border"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={updateConfig.isPending || !enabled}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateConfig.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
