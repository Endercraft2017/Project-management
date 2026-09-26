/**
 * Send Email Button (Admin Only)
 */

import { Mail, Loader2 } from 'lucide-react';
import { useSendSummaryEmail } from '@/hooks/useSummaries';
import { useToast } from '@/contexts/ToastContext';

interface SendEmailButtonProps {
  weekDate: string;
}

export default function SendEmailButton({ weekDate }: SendEmailButtonProps) {
  const sendEmail = useSendSummaryEmail();
  const { toast } = useToast();

  const handleSend = async () => {
    try {
      const result = await sendEmail.mutateAsync(weekDate);
      toast({
        title: 'Email sent',
        description: result.message || 'Weekly summary has been emailed',
        variant: 'success',
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send email';
      toast({
        title: 'Email failed',
        description: message,
        variant: 'error',
      });
    }
  };

  return (
    <button
      onClick={handleSend}
      disabled={sendEmail.isPending}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
    >
      {sendEmail.isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <Mail className="h-4 w-4" />
          Send Email
        </>
      )}
    </button>
  );
}
