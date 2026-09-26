/**
 * Delete Summary Button (Admin Only)
 * Deletes a weekly summary with confirmation dialog
 */

import { useState } from 'react';
import { Trash2, Loader2, X, AlertTriangle } from 'lucide-react';
import { useDeleteSummary } from '@/hooks/useSummaries';
import { useToast } from '@/contexts/ToastContext';

interface DeleteSummaryButtonProps {
  summaryId: string;
  weekDate: string;
  onDeleted?: () => void;
}

export default function DeleteSummaryButton({
  summaryId,
  weekDate,
  onDeleted
}: DeleteSummaryButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const deleteSummary = useDeleteSummary();
  const { toast } = useToast();

  const formatDateRange = (weekDate: string) => {
    const start = new Date(weekDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startFormatted = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const endFormatted = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return `${startFormatted} - ${endFormatted}`;
  };

  const handleDelete = async () => {
    try {
      await deleteSummary.mutateAsync(summaryId);
      toast({
        title: 'Summary deleted',
        description: 'Weekly summary has been permanently deleted',
        variant: 'success',
      });
      setShowConfirm(false);
      if (onDeleted) {
        onDeleted();
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete summary';
      toast({
        title: 'Delete failed',
        description: message,
        variant: 'error',
      });
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-background px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4" />
        Delete Summary
      </button>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => !deleteSummary.isPending && setShowConfirm(false)}
          />

          {/* Dialog */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-lg font-semibold">Delete Weekly Summary</h2>
                </div>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleteSummary.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete the weekly summary for{' '}
                  <span className="font-medium text-foreground">
                    {formatDateRange(weekDate)}
                  </span>?
                </p>

                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-300">
                    <strong>Warning:</strong> This action cannot be undone. All member summaries
                    and associated data will be permanently deleted.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-6">
                <button
                  onClick={handleDelete}
                  disabled={deleteSummary.isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteSummary.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Summary'
                  )}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleteSummary.isPending}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
