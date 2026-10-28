/**
 * TanStack Query Hooks for Team Invitation Management
 * Provides data fetching, caching, and mutation hooks for invitations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, get, post, del } from "@/lib/api";
import { userKeys } from "./useUsers";
import type {
  TeamInvite,
  SendInviteInput,
  AcceptInviteInput,
  InviteFilters,
  ValidateInviteResponse,
  User,
} from "@/types";

// Query keys for cache management
export const inviteKeys = {
  all: ["invites"] as const,
  lists: () => [...inviteKeys.all, "list"] as const,
  list: (filters?: InviteFilters) => [...inviteKeys.lists(), filters] as const,
  validate: (token: string) => [...inviteKeys.all, "validate", token] as const,
};

/**
 * Fetch all team invitations (Admin only)
 * Supports filtering by status and email
 */
export function useInvites(filters?: InviteFilters) {
  return useQuery({
    queryKey: inviteKeys.list(filters),
    queryFn: async () => {
      const response = await api.get<{
        success: boolean;
        data: TeamInvite[];
        count: number;
      }>("/api/invites", { params: filters });
      return response.data.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Validate invitation token (Public endpoint)
 * Returns invitation details without accepting it
 */
export function useValidateInvite(token: string | null) {
  return useQuery({
    queryKey: inviteKeys.validate(token || ""),
    queryFn: () =>
      get<ValidateInviteResponse>(`/api/invites/validate?token=${token}`),
    enabled: !!token, // Only run query if token exists
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry if token is invalid
  });
}

/**
 * Send a new team invitation (Admin only)
 */
export function useSendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendInviteInput) =>
      post<TeamInvite>("/api/invites", data),
    onSuccess: () => {
      // Invalidate and refetch invitations list
      queryClient.invalidateQueries({ queryKey: inviteKeys.lists() });
      // Also invalidate users list in case a user was reactivated
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Accept a team invitation (Public endpoint)
 * Creates a new user account and marks the invitation as accepted
 */
export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (data: AcceptInviteInput) => {
      const response = await api.post<{
        success: boolean;
        message: string;
        data: {
          user: User;
          invite: {
            id: string;
            acceptedAt: string;
          };
        };
      }>("/api/invites/accept", data);
      return response.data.data;
    },
  });
}

/**
 * Revoke a pending invitation (Admin only)
 * Only PENDING invitations can be revoked
 */
export function useRevokeInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) =>
      del<{ success: boolean; message: string }>(`/api/invites/${inviteId}`),
    onSuccess: () => {
      // Invalidate and refetch invitations list
      queryClient.invalidateQueries({ queryKey: inviteKeys.lists() });
    },
  });
}
