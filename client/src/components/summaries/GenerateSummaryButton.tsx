import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useGenerateSummary, useSummaryJob } from "@/hooks/useSummaries";
import { apiErrorMessage } from "@/lib/api-error";

interface GenerateSummaryButtonProps {
  weekDate: string;
}

export default function GenerateSummaryButton({
  weekDate,
}: GenerateSummaryButtonProps) {
  const generate = useGenerateSummary();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useSummaryJob(jobId);
  const busy =
    generate.isPending ||
    (!!jobId &&
      !job.isError &&
      job.data?.status !== "DONE" &&
      job.data?.status !== "FAILED");
  const status = job.data?.status;
  const message = generate.isError
    ? apiErrorMessage(generate.error) ||
      "AI generation is unavailable. It requires an enabled provider, a running worker and a company AI allowance."
    : job.isError
      ? "Could not read generation status. Retry status to check the existing job."
      : status === "FAILED"
        ? `Generation failed (${job.data?.errorCode || "GENERATION_FAILED"}). No successful summary is available from this job.`
        : status === "DONE"
          ? "Summary generated. The saved summary has been refreshed."
          : busy
            ? `Generation ${status === "RUNNING" ? "running" : "queued"}. You can keep using the workspace.`
            : "";
  const handleGenerate = async () => {
    try {
      const accepted = await generate.mutateAsync(weekDate);
      setJobId(accepted.jobId);
    } catch {
      /* Mutation error is rendered inline without clearing the selected week. */
    }
  };
  return (
    <div className="space-y-2">
      <button
        onClick={handleGenerate}
        disabled={busy || job.isError}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {busy ? "Generating…" : "Generate summary"}
      </button>
      {job.isError && (
        <button
          type="button"
          onClick={() => void job.refetch()}
          className="ml-3 text-sm underline"
        >
          Retry status
        </button>
      )}
      {message && (
        <p
          role={
            generate.isError || job.isError || status === "FAILED"
              ? "alert"
              : "status"
          }
          className="max-w-md text-sm text-muted-foreground"
        >
          {message}
        </p>
      )}
      {!jobId && !generate.isError && (
        <p className="max-w-md text-sm text-muted-foreground">
          AI requires an enabled provider and company allowance. Companies with
          an allowance of zero cannot generate summaries.
        </p>
      )}
    </div>
  );
}
