/**
 * Users List Component
 * Displays table of all team members with admin controls
 */

import { useState } from 'react';
import { Users, Trash2, AlertCircle, RefreshCw, Shield, User, Check, X } from 'lucide-react';
import { useUsers, useDeactivateUser } from '@/hooks/useUsers';
import { useToast } from '@/contexts/ToastContext';
import { cn, formatDate } from '@/lib/utils';
import type { User as UserType } from '@/types';

interface UsersListProps {
  currentUserId: string;
}

export default function UsersList({ currentUserId }: UsersListProps) {
  const { data: usersData, isLoading, error } = useUsers({ isActive: true });
  const deactivateUserMutation = useDeactivateUser();
  const { toast } = useToast();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleRemoveUser = async (user: UserType) => {
    try {
      await deactivateUserMutation.mutateAsync(user.id);
      toast({
        title: 'Member removed',
        description: `${user.name} has been removed from the team`,
        variant: 'success',
      });
      setConfirmRemoveId(null);
    } catch (error: any) {
      toast({
        title: 'Failed to remove member',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading team members
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Failed to fetch team members. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const users = Array.isArray(usersData?.data?.users) ? usersData.data.users : [];

  if (users.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold">No team members</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite team members to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Member
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Email
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Joined
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-muted/30 transition-colors">
              <td className="whitespace-nowrap px-6 py-4">
                <div className="flex items-center">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="ml-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{user.name}</span>
                      {user.id === currentUserId && (
                        <span className="text-xs text-muted-foreground">(You)</span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {user.email}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                    user.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  )}
                >
                  {user.role === 'ADMIN' ? (
                    <Shield className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {user.role}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {formatDate(user.createdAt)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  {/* Remove Button (disabled for current user) */}
                  {user.id !== currentUserId && (
                    <>
                      {confirmRemoveId === user.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Remove?
                          </span>
                          <button
                            onClick={() => handleRemoveUser(user)}
                            disabled={deactivateUserMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-4 w-4" />
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveId(user.id)}
                          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Remove member from team"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
