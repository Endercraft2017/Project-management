/**
 * Email Settings Tab
 * Configuration for automated weekly summary emails
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useEmailConfig, useUpdateEmailConfig } from '@/hooks/useSummaries';
import { useToast } from '@/contexts/ToastContext';
import type { WeeklySummaryEmailConfig } from '@/types';

interface EmailSettingsTabProps {
  onClose?: () => void;
}

export default function EmailSettingsTab({ onClose }: EmailSettingsTabProps) {
  const { data: config, isLoading } = useEmailConfig();
  const updateConfig = useUpdateEmailConfig();
  const { toast } = useToast();

  const [formData, setFormData] = useState<WeeklySummaryEmailConfig>({
    enabled: false,
    recipientEmail: '',
    sendDay: 'MONDAY',
    sendTime: '09:00',
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
        description: 'Email configuration has been saved successfully',
        variant: 'success',
      });
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.response?.data?.message || 'Failed to update email settings',
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
        <h3 className="text-lg font-semibold mb-2">Automated Email Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure automated weekly summary emails to be sent to specified recipients.
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
          <div className="text-sm font-medium">Enable Automated Emails</div>
          <div className="text-xs text-muted-foreground mt-1">
            Send weekly summary emails automatically on a scheduled basis
          </div>
        </div>
      </label>

      {/* Recipient Email */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Recipient Email Address
        </label>
        <input
          type="email"
          value={formData.recipientEmail}
          onChange={(e) =>
            setFormData({ ...formData, recipientEmail: e.target.value })
          }
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="manager@example.com"
        />
        <p className="text-xs text-muted-foreground mt-1">
          The email address where weekly summaries will be sent
        </p>
      </div>

      {/* Send Day */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Send Day
        </label>
        <select
          value={formData.sendDay}
          onChange={(e) =>
            setFormData({ ...formData, sendDay: e.target.value as any })
          }
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="MONDAY">Monday</option>
          <option value="TUESDAY">Tuesday</option>
          <option value="WEDNESDAY">Wednesday</option>
          <option value="THURSDAY">Thursday</option>
          <option value="FRIDAY">Friday</option>
          <option value="SATURDAY">Saturday</option>
          <option value="SUNDAY">Sunday</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          The day of the week when emails should be sent
        </p>
      </div>

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
          The time of day when emails should be sent (server timezone)
        </p>
      </div>

      {/* Info Box */}
      {formData.enabled && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            📧 <strong>Scheduled:</strong> Emails will be sent every {formData.sendDay.charAt(0) + formData.sendDay.slice(1).toLowerCase()} at {formData.sendTime} to <strong>{formData.recipientEmail || '(not set)'}</strong>
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
