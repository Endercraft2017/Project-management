import { apiErrorMessage } from '@/lib/api-error';
/**
 * Member Selection Tab
 * Shared member selection for weekly summaries and missing updates tracking
 */

import { useState, useEffect, useMemo } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useMembersConfig, useUpdateMembersConfig } from '@/hooks/useSummaries';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/contexts/toast-context';
import type { User } from '@/types';

export default function MemberSelectionTab() {
  const { data: config, isLoading: configLoading } = useMembersConfig();
  const { data: usersData, isLoading: usersLoading } = useUsers({ isActive: true });
  const updateConfig = useUpdateMembersConfig();
  const { toast } = useToast();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Get the users array from the API response
  const users = useMemo(() => usersData?.data?.users || [], [usersData]);

  // Initialize with config or all users (default)
  useEffect(() => {
    if (config && config.includedUserIds) {
      setSelectedUserIds(config.includedUserIds);
    } else if (users.length > 0) {
      // Default: all users selected
      setSelectedUserIds(users.map((u: User) => u.id));
    }
  }, [config, users]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAll = () => {
    if (selectedUserIds.length === users.length) {
      // Deselect all
      setSelectedUserIds([]);
    } else {
      // Select all
      setSelectedUserIds(users.map((u: User) => u.id));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfig.mutateAsync({
        includedUserIds: selectedUserIds,
      });
      toast({
        title: 'Settings Updated',
        description: `${selectedUserIds.length} member(s) selected for weekly summaries and missing updates tracking`,
        variant: 'success',
      });
    } catch (error: unknown) {
      toast({
        title: 'Update Failed',
        description: apiErrorMessage(error) || 'Failed to update member selection',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = configLoading || usersLoading;
  const hasChanges = config && JSON.stringify(config.includedUserIds.sort()) !== JSON.stringify(selectedUserIds.sort());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Team Member Selection</h3>
        <p className="text-sm text-muted-foreground">
          Select team members to include in weekly summary generation and missing updates tracking.
          Only selected members will have their daily updates processed.
        </p>
      </div>

      {/* Select All/None */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-sm font-medium">
          {selectedUserIds.length} of {users.length} selected
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-primary hover:underline"
        >
          {selectedUserIds.length === users.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Member List */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active team members found
          </p>
        ) : (
          users.map((user: User) => (
            <label
              key={user.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
            >
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={() => toggleUser(user.id)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                    selectedUserIds.includes(user.id)
                      ? 'bg-primary border-primary'
                      : 'border-border bg-background'
                  }`}
                >
                  {selectedUserIds.includes(user.id) && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.email}
                </div>
              </div>
              {user.role === 'ADMIN' && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                  Admin
                </span>
              )}
            </label>
          ))
        )}
      </div>

      {/* Warning for no selection */}
      {selectedUserIds.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            ⚠️ Warning: No members selected. Weekly summaries and missing updates will not be generated.
          </p>
        </div>
      )}

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
