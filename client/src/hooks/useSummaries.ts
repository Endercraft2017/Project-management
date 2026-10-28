/**
 * Custom hooks for Weekly Summaries API
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import type {
  WeeklySummary,
  GroupedWeeklySummary,
  WeeklySummaryListItem,
  WeeklySummaryEmailConfig,
  WeeklySummaryMembersConfig,
  AutomatedReminderConfig,
  AdminSetting,
} from "@/types";

// Query Keys
export const SUMMARIES_KEYS = {
  all: ["summaries"] as const,
  list: () => [...SUMMARIES_KEYS.all, "list"] as const,
  byWeek: (weekDate: string) =>
    [...SUMMARIES_KEYS.all, "week", weekDate] as const,
  grouped: (weekDate: string) =>
    [...SUMMARIES_KEYS.all, "grouped", weekDate] as const,
};

export const ADMIN_KEYS = {
  all: ["admin"] as const,
  emailConfig: () => [...ADMIN_KEYS.all, "email-config"] as const,
  membersConfig: () => [...ADMIN_KEYS.all, "members-config"] as const,
  automatedReminderConfig: () =>
    [...ADMIN_KEYS.all, "automated-reminder-config"] as const,
};

/**
 * List all weekly summaries
 */
export function useWeeklySummaries(limit = 10, offset = 0) {
  return useQuery({
    queryKey: [...SUMMARIES_KEYS.list(), limit, offset],
    queryFn: async () => {
      const response = await get<{
        summaries: WeeklySummaryListItem[];
        total: number;
        limit: number;
        offset: number;
      }>(`/api/summaries?limit=${limit}&offset=${offset}`);
      return response;
    },
  });
}

/**
 * Get weekly summary for a specific week
 */
export function useWeeklySummary(weekDate: string) {
  return useQuery({
    queryKey: SUMMARIES_KEYS.byWeek(weekDate),
    queryFn: () => get<WeeklySummary>(`/api/summaries/${weekDate}`),
    enabled: !!weekDate,
  });
}

/**
 * Get grouped weekly summary (by impact level)
 */
export function useGroupedWeeklySummary(weekDate: string) {
  return useQuery({
    queryKey: SUMMARIES_KEYS.grouped(weekDate),
    queryFn: () =>
      get<GroupedWeeklySummary>(`/api/summaries/${weekDate}/grouped`),
    enabled: !!weekDate,
  });
}

export interface SummaryJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Enqueue one durable job; acceptance is not successful generation. */
export function useGenerateSummary() {
  return useMutation({
    mutationFn: (weekDate: string) =>
      post<{ jobId: string; status: SummaryJob["status"]; weekDate: string }>(
        "/api/summaries/generate",
        { weekDate },
      ),
  });
}

/** Poll only while a job is active, then refresh the persisted summary. */
export function useSummaryJob(jobId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...SUMMARIES_KEYS.all, "job", jobId],
    queryFn: () =>
      get<SummaryJob>(`/api/summaries/jobs/${encodeURIComponent(jobId!)}`),
    enabled: !!jobId,
    retry: false,
    refetchInterval: (result) => {
      const status = result.state.data?.status;
      return result.state.error || status === "DONE" || status === "FAILED"
        ? false
        : 2000;
    },
  });
  useEffect(() => {
    if (query.data?.status === "DONE") {
      void queryClient.invalidateQueries({ queryKey: SUMMARIES_KEYS.all });
    }
  }, [query.data?.status, queryClient]);
  return query;
}

/**
 * Send summary email manually (Admin only)
 */
export function useSendSummaryEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (weekDate: string) =>
      post<{ success: boolean; message: string }>(
        `/api/summaries/${weekDate}/send-email`,
        {},
      ),
    onSuccess: (_, weekDate) => {
      // Invalidate the summary to refresh emailSentAt
      queryClient.invalidateQueries({
        queryKey: SUMMARIES_KEYS.byWeek(weekDate),
      });
    },
  });
}

/**
 * Delete a weekly summary (Admin only)
 */
export function useDeleteSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (summaryId: string) =>
      del<{ success: boolean }>(`/api/summaries/${summaryId}`),
    onSuccess: () => {
      // Invalidate all summaries
      queryClient.invalidateQueries({ queryKey: SUMMARIES_KEYS.all });
    },
  });
}

/**
 * Get email configuration (Admin only)
 */
export function useEmailConfig() {
  return useQuery({
    queryKey: ADMIN_KEYS.emailConfig(),
    queryFn: () =>
      get<WeeklySummaryEmailConfig>(
        "/api/admin/settings/weekly-summary-email/config",
      ),
  });
}

/**
 * Update email configuration (Admin only)
 */
export function useUpdateEmailConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: WeeklySummaryEmailConfig) =>
      put<AdminSetting>(
        "/api/admin/settings/weekly-summary-email/config",
        config,
      ),
    onSuccess: () => {
      // Invalidate email config
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.emailConfig() });
    },
  });
}

/**
 * Get member selection configuration (Admin only)
 */
export function useMembersConfig() {
  return useQuery({
    queryKey: ADMIN_KEYS.membersConfig(),
    queryFn: async () => {
      const response = await get<WeeklySummaryMembersConfig | null>(
        "/api/admin/settings/weekly-summary-members/config",
      );
      return response;
    },
  });
}

/**
 * Update member selection configuration (Admin only)
 */
export function useUpdateMembersConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: WeeklySummaryMembersConfig) =>
      put<AdminSetting>(
        "/api/admin/settings/weekly-summary-members/config",
        config,
      ),
    onSuccess: () => {
      // Invalidate members config
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.membersConfig() });
    },
  });
}

/**
 * Get automated daily reminder configuration (Admin only)
 */
export function useAutomatedReminderConfig() {
  return useQuery({
    queryKey: ADMIN_KEYS.automatedReminderConfig(),
    queryFn: () =>
      get<AutomatedReminderConfig>(
        "/api/admin/settings/automated-reminder/config",
      ),
  });
}

/**
 * Update automated daily reminder configuration (Admin only)
 */
export function useUpdateAutomatedReminderConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AutomatedReminderConfig) =>
      put<AdminSetting>(
        "/api/admin/settings/automated-reminder/config",
        config,
      ),
    onSuccess: () => {
      // Invalidate automated reminder config
      queryClient.invalidateQueries({
        queryKey: ADMIN_KEYS.automatedReminderConfig(),
      });
    },
  });
}
