/**
 * Invites List Component
 * Displays table of all team invitations with status and actions
 */

import { useState } from 'react';
import { Mail, RefreshCw, X, Check, Clock, Ban, AlertCircle } from 'lucide-react';
import { useInvites, useRevokeInvite, useResendInvite } from '@/hooks/useInvites';
import { useToast } from '@/contexts/ToastContext';
import type { InviteStatus } from '@/types';
import { cn, formatDate } from '@/lib/utils';

interface InvitesListProps {
  statusFilter?: InviteStatus;
}

export default function InvitesList({ statusFilter }: InvitesListProps) {
  const { data: invites, isLoading, error } = useInvites({ status: statusFilter });
  const revokeInviteMutation = useRevokeInvite();
  const resendInviteMutation = useResendInvite();
  const { toast } = useToast();
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const handleRevoke = async (inviteId: string, email: string) => {
    try {
      await revokeInviteMutation.mutateAsync(inviteId);
      toast({
        title: 'Invitation revoked',
        description: `Invitation to ${email} has been revoked`,
        variant: 'success',
      });
      setConfirmRevokeId(null);
    } catch (error: any) {
      toast({
        title: 'Failed to revoke invitation',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'error',
      });
    }
  };

  const handleResend = async (inviteId: string, email: string) => {
    try {
      await resendInviteMutation.mutateAsync(inviteId);
      toast({
        title: 'Invitation resent',
        description: `Invitation email resent to ${email}`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to resend invitation',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'error',
      });
    }
  };

  const getStatusBadge = (status: InviteStatus) => {
    const badges = {
      PENDING: {
        icon: Clock,
        text: 'Pending',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      },
      ACCEPTED: {
        icon: Check,
        text: 'Accepted',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      },
      EXPIRED: {
        icon: AlertCircle,
        text: 'Expired',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      },
      REVOKED: {
        icon: Ban,
        text: 'Revoked',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      },
    };

    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
          badge.className
        )}
      >
        <Icon className="h-3 w-3" />
        {badge.text}
      </span>
    );
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 2 && daysUntilExpiry > 0;
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
              Error loading invitations
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Failed to fetch invitations. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!invites || invites.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold">No invitations</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {statusFilter
            ? `No ${statusFilter.toLowerCase()} invitations found.`
            : 'Get started by inviting a team member.'}
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
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Invited By
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Expires
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {invites.map((invite) => (
            <tr key={invite.id} className="hover:bg-muted/30 transition-colors">
              <td className="whitespace-nowrap px-6 py-4">
                <div className="flex items-center">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{invite.email}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                <span
                  className={cn(
                    'inline-flex rounded-md px-2 py-1 text-xs font-medium',
                    invite.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  )}
                >
                  {invite.role}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                {getStatusBadge(invite.status)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {invite.invitedBy.name}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                <div className="flex flex-col">
                  <span
                    className={cn(
                      isExpiringSoon(invite.expiresAt) &&
                        invite.status === 'PENDING' &&
                        'text-orange-600 font-medium'
                    )}
                  >
                    {formatDate(invite.expiresAt)}
                  </span>
                  {isExpiringSoon(invite.expiresAt) &&
                    invite.status === 'PENDING' && (
                      <span className="text-xs text-orange-500">
                        Expiring soon
                      </span>
                    )}
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  {/* Resend Button */}
                  {invite.status === 'PENDING' && (
                    <button
                      onClick={() => handleResend(invite.id, invite.email)}
                      disabled={resendInviteMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                      title="Resend invitation email"
                    >
                      <RefreshCw
                        className={cn(
                          'h-4 w-4',
                          resendInviteMutation.isPending && 'animate-spin'
                        )}
                      />
                      Resend
                    </button>
                  )}

                  {/* Revoke Button */}
                  {invite.status === 'PENDING' && (
                    <>
                      {confirmRevokeId === invite.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Confirm?
                          </span>
                          <button
                            onClick={() => handleRevoke(invite.id, invite.email)}
                            disabled={revokeInviteMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmRevokeId(null)}
                            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-4 w-4" />
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRevokeId(invite.id)}
                          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Revoke invitation"
                        >
                          <Ban className="h-4 w-4" />
                          Revoke
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
