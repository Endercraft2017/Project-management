/**
 * Generate Summary Button (Admin Only)
 */

import { Sparkles, Loader2 } from 'lucide-react';
import { useGenerateSummary } from '@/hooks/useSummaries';
import { useToast } from '@/contexts/ToastContext';

interface GenerateSummaryButtonProps {
  weekDate: string;
}

export default function GenerateSummaryButton({ weekDate }: GenerateSummaryButtonProps) {
  const generateSummary = useGenerateSummary();
  const { toast } = useToast();

  const handleGenerate = async () => {
    try {
      await generateSummary.mutateAsync(weekDate);
      toast({
        title: 'Summary generated',
        description: 'The weekly summary has been generated successfully',
        variant: 'success',
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to generate summary';
      toast({
        title: 'Generation failed',
        description: message,
        variant: 'error',
      });
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={generateSummary.isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {generateSummary.isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Generate Summary
        </>
      )}
    </button>
  );
}
