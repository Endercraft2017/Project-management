import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";

const MAX_BYTES = 20 * 1024 * 1024;

export default function WorkspaceDataTab() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    mounted.current = true;
    const activeDownloads = downloads.current;
    return () => {
      mounted.current = false;
      request.current?.abort();
      activeDownloads.forEach((timer, url) => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      });
      activeDownloads.clear();
    };
  }, []);

  async function download() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    setReady(false);
    try {
      const response = await api.get<Blob>("/api/export/workspace", {
        responseType: "blob",
        signal: controller.signal,
        timeout: 45000,
      });
      if (controller.signal.aborted) return;
      const file = response.data;
      if (
        !(file instanceof Blob) ||
        !file.type.includes("application/json") ||
        file.size > MAX_BYTES
      )
        throw new Error("Invalid export response");
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "E-Z-workspace-export.json";
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        const timer = setTimeout(() => {
          URL.revokeObjectURL(url);
          downloads.current.delete(url);
        }, 1000);
        downloads.current.set(url, timer);
      }
      setReady(true);
    } catch (failure) {
      if (!mounted.current || controller.signal.aborted) return;
      const status = (failure as { response?: { status?: number } })?.response
        ?.status;
      setError(
        status === 429
          ? "An export is already running or the hourly limit was reached. Please try again later."
          : status === 413
            ? "This workspace exceeds the self-service export limit. Contact support for an assisted export."
            : status === 401 || status === 403
              ? "Your administrator access could not be verified. Sign in again before exporting."
              : "We could not prepare the export. Please try again.",
      );
    } finally {
      request.current = null;
      if (mounted.current) setPending(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="workspace-data-heading">
      <div>
        <h3 id="workspace-data-heading" className="text-lg font-semibold">
          Export workspace data
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Download a JSON snapshot of your company directory, projects, tasks,
          sprints, daily updates, invitation metadata and weekly summaries.
          Conversations are included only when you belong to them.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">What the download includes</p>
        <p className="mt-2 text-muted-foreground">
          Authorized attachment metadata is included; file contents are not.
          Personal notes, reminders, notifications, credentials, invitation
          tokens, settings and raw AI source data are excluded. Deleted message
          content and its attachment metadata are omitted.
        </p>
        <p className="mt-2 text-muted-foreground">
          This snapshot is not a restorable backup or a complete personal-data
          portability response. Keep the downloaded file private: it contains
          company and member information.
        </p>
      </div>
      <p id="workspace-export-limits" className="text-sm text-muted-foreground">
        Up to 10,000 records and 20 MiB per export. Each administrator can
        request two exports per hour. Exports are prepared one at a time. Larger
        workspaces need an assisted export.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {ready && (
        <p role="status" className="text-sm text-muted-foreground">
          Download prepared. Check your browser downloads.
        </p>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        aria-busy={pending}
        aria-describedby="workspace-export-limits"
        onClick={download}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {pending ? "Preparing export…" : "Download JSON export"}
      </button>
    </section>
  );
}
