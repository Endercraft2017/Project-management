/**
 * Email Settings Button (Admin Only)
 * Opens a dialog to configure weekly summary email settings
 */

import { useState, useEffect } from 'react';
import { Settings, Loader2, X } from 'lucide-react';
import { useEmailConfig, useUpdateEmailConfig } from '@/hooks/useSummaries';
import { useToast } from '@/contexts/ToastContext';
import type { WeeklySummaryEmailConfig } from '@/types';

export default function EmailSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: config, isLoading } = useEmailConfig();
  const updateConfig = useUpdateEmailConfig();
  const { toast } = useToast();

  const [formData, setFormData] = useState<WeeklySummaryEmailConfig>({
    enabled: false,
    recipientEmail: '',
    sendDay: 'MONDAY',
    sendTime: '09:00',
  });

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateConfig.mutateAsync(formData);
      toast({
        title: 'Settings updated',
        description: 'Email configuration has been saved',
        variant: 'success',
      });
      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.response?.data?.message || 'Failed to update settings',
        variant: 'error',
      });
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        <Settings className="h-4 w-4" />
        Email Settings
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Email Settings</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Enable/Disable */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium">Enable automated emails</span>
              </label>

              {/* Recipient Email */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={formData.recipientEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, recipientEmail: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="manager@example.com"
                />
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="MONDAY">Monday</option>
                  <option value="TUESDAY">Tuesday</option>
                  <option value="WEDNESDAY">Wednesday</option>
                  <option value="THURSDAY">Thursday</option>
                  <option value="FRIDAY">Friday</option>
                  <option value="SATURDAY">Saturday</option>
                  <option value="SUNDAY">Sunday</option>
                </select>
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4">
                <button
                  type="submit"
                  disabled={updateConfig.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {updateConfig.isPending ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
