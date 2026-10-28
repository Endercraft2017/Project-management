import { apiErrorMessage } from '@/lib/api-error';
/**
 * Member Selection Button (Admin Only)
 * Opens a dialog to select which team members are included in weekly summaries
 */

import { useState, useEffect, useMemo } from 'react';
import { Users, Loader2, X, Check } from 'lucide-react';
import { useMembersConfig, useUpdateMembersConfig } from '@/hooks/useSummaries';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/contexts/toast-context';
import type { User } from '@/types';

export default function MemberSelectionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: config, isLoading: configLoading } = useMembersConfig();
  const { data: usersData, isLoading: usersLoading } = useUsers({ isActive: true });
  const updateConfig = useUpdateMembersConfig();
  const { toast } = useToast();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateConfig.mutateAsync({
        includedUserIds: selectedUserIds,
      });
      toast({
        title: 'Settings updated',
        description: `${selectedUserIds.length} member(s) selected for weekly summaries`,
        variant: 'success',
      });
      setIsOpen(false);
    } catch (error: unknown) {
      toast({
        title: 'Update failed',
        description: apiErrorMessage(error) || 'Failed to update member selection',
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
        <Users className="h-4 w-4" />
        Select Members
      </button>
    );
  }

  const isLoading = configLoading || usersLoading;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Select Team Members</h2>
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
              {/* Description */}
              <p className="text-sm text-muted-foreground">
                Select team members to include in weekly summary generation.
                Only selected members will have their daily updates processed.
              </p>

              {/* Select All/None */}
              <div className="flex items-center justify-between border-b border-border pb-2">
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
              <div className="max-h-64 overflow-y-auto space-y-2">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active team members found
                  </p>
                ) : (
                  users.map((user: User) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
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
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Admin
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>

              {/* Warning for no selection */}
              {selectedUserIds.length === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Warning: No members selected. Weekly summaries will not be generated.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4">
                <button
                  type="submit"
                  disabled={updateConfig.isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {updateConfig.isPending ? 'Saving...' : 'Save Selection'}
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
