import { apiErrorMessage } from '@/lib/api-error';
/**
 * Automated Daily Reminders Settings Tab
 * Configuration for automated daily update reminders
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAutomatedReminderConfig, useUpdateAutomatedReminderConfig } from '@/hooks/useSummaries';
import { useToast } from '@/contexts/toast-context';
import type { AutomatedReminderConfig } from '@/types';

interface AutomatedRemindersTabProps {
  onClose?: () => void;
}

export default function AutomatedRemindersTab({ onClose }: AutomatedRemindersTabProps) {
  const { data: config, isLoading } = useAutomatedReminderConfig();
  const updateConfig = useUpdateAutomatedReminderConfig();
  const { toast } = useToast();

  const [formData, setFormData] = useState<AutomatedReminderConfig>({
    enabled: false,
    sendTime: '21:00',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateConfig.mutateAsync(formData);
      toast({
        title: 'Settings Updated',
        description: 'Automated reminder configuration has been saved successfully',
        variant: 'success',
      });
      if (onClose) {
        onClose();
      }
    } catch (error: unknown) {
      toast({
        title: 'Update Failed',
        description: apiErrorMessage(error) || 'Failed to update automated reminder settings',
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Automated Daily Reminders</h3>
        <p className="text-sm text-muted-foreground">
          Configure automated daily update reminders to be sent to team members who haven't submitted their updates.
        </p>
      </div>

      {/* Enable/Disable */}
      <label className="flex items-start gap-3 cursor-pointer">
        <div className="relative flex items-center justify-center pt-0.5">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="sr-only"
          />
          <div
            className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
              formData.enabled
                ? 'bg-primary border-primary'
                : 'border-border bg-background'
            }`}
          >
            {formData.enabled && (
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Enable Automated Reminders</div>
          <div className="text-xs text-muted-foreground mt-1">
            Automatically send daily update reminders to team members who haven't submitted updates for the current day
          </div>
        </div>
      </label>

      {/* Send Time */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Send Time (24-hour format)
        </label>
        <input
          type="time"
          value={formData.sendTime}
          onChange={(e) => setFormData({ ...formData, sendTime: e.target.value })}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The time of day when automated reminders should be sent (Philippines timezone - GMT+8)
        </p>
      </div>

      {/* Info Box */}
      {formData.enabled && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Schedule:</strong> Every weekday (Monday-Friday) at {formData.sendTime}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Who receives reminders:</strong> Team members selected in the "Team Members" tab who haven't submitted updates for the current day
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>What they receive:</strong>
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside pl-4">
            <li>Webapp notification showing ALL missing dates from the current week</li>
            <li>Email notification for TODAY only with a direct link to submit their update</li>
          </ul>
        </div>
      )}

      {/* Weekend Notice */}
      {formData.enabled && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Note: Reminders are only sent on weekdays (Monday-Friday). No reminders will be sent on weekends.
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-end pt-4 border-t border-border">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
