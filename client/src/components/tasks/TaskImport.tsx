import { apiErrorMessage } from "@/lib/api-error";
/**
 * Task Import Component
 * CSV/Excel import functionality for bulk task creation
 */

import { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import ConflictResolutionModal from "../sync/ConflictResolutionModal";
import { api } from "@/lib/api";
import {
  getWorkspaceContext,
  workspaceContextChanged,
  markWorkspaceChanged,
} from "@/lib/workspace-context";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  tasks: Array<{ id: string; name: string; progress: number }>;
  conflicts?: Array<{
    taskId: string;
    taskName: string;
    reason: string;
    dbDetails: string;
    csvDetails: string;
    conflictType?: string;
    resolution?: string;
  }>;
  spreadsheetId?: string;
  sheetName?: string;
}

interface TaskImportProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function TaskImport({ onSuccess, onClose }: TaskImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [noteConflicts, setNoteConflicts] = useState<
    Array<{
      taskId: string;
      taskName: string;
      reason: string;
      dbDetails: string;
      csvDetails: string;
    }>
  >([]);
  const [pendingImportData, setPendingImportData] = useState<{
    spreadsheetId: string;
    sheetName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (
      !allowedTypes.includes(selectedFile.type) &&
      !selectedFile.name.match(/\.(csv|xlsx|xls)$/i)
    ) {
      setError("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError("File too large. Maximum size is 5MB.");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file || workspaceContextChanged()) return;

    setImporting(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          const importResult: ImportResult = response.data;

          // Check if there are note conflicts that need resolution
          const conflictsNeedingResolution =
            importResult.conflicts?.filter(
              (c) =>
                c.conflictType === "notesConflict" &&
                c.resolution === "needsResolution",
            ) || [];

          if (
            conflictsNeedingResolution.length > 0 &&
            importResult.spreadsheetId &&
            importResult.sheetName
          ) {
            // Show conflict resolution modal
            setNoteConflicts(conflictsNeedingResolution);
            setPendingImportData({
              spreadsheetId: importResult.spreadsheetId,
              sheetName: importResult.sheetName,
            });
            setShowConflictModal(true);
            setImporting(false);
          } else {
            // No conflicts or all resolved - show result
            setResult(importResult);
            setImporting(false);
            if (onSuccess) {
              setTimeout(onSuccess, 1000); // Refresh after 1 second
            }
          }
        } else {
          if (xhr.status === 409) markWorkspaceChanged();
          const errorResponse = JSON.parse(xhr.responseText);
          setError(errorResponse.message || "Import failed. Please try again.");
          setImporting(false);
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        setError("Network error. Please check your connection and try again.");
        setImporting(false);
      });

      xhr.open("POST", "/api/upload/tasks-import");
      xhr.withCredentials = true;
      const context = getWorkspaceContext();
      if (context) xhr.setRequestHeader("X-EZ-Workspace", context);
      xhr.send(formData);
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || "Import failed. Please try again.");
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setShowConflictModal(false);
    setNoteConflicts([]);
    setPendingImportData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResolveConflicts = async (
    resolutions: Array<{
      taskId: string;
      resolution: "useDb" | "useSheet" | "merge";
    }>,
  ) => {
    if (!pendingImportData) return;

    setImporting(true);
    setShowConflictModal(false);

    try {
      const response = await api.post("/api/sync/resolve-conflicts", {
        spreadsheetId: pendingImportData.spreadsheetId,
        sheetName: pendingImportData.sheetName,
        resolutions,
      });

      // Show success result
      setResult({
        imported: 0,
        skipped: 0,
        errors: [],
        tasks: [],
        conflicts: response.data.data.conflicts,
      });

      setImporting(false);

      if (onSuccess) {
        setTimeout(onSuccess, 1000);
      }
    } catch (err: unknown) {
      setError(
        apiErrorMessage(err) ||
          "Failed to resolve conflicts. Please try again.",
      );
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Setup Development Environment,,Sprint 1,Install Node.js PostgreSQL and configure environment,100,John Doe,2025-01-15
Database Schema Design,,Sprint 1,Design and implement database schema with all models,75,Jane Smith,2025-01-20
User Model,Database Schema Design,Sprint 1,Create User model with authentication fields,50,John Doe,2025-01-25
Task Model,Database Schema Design,Sprint 1,Create Task model with hierarchy support,50,Jane Smith,2025-01-27
API Development,,Sprint 2,Build REST API endpoints for all features,25,John Doe,2025-02-05`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "task-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Import Tasks from CSV/Excel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bulk import tasks from a spreadsheet file
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-2 hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Template Download */}
      <div className="mb-6 rounded-md border border-border bg-muted p-4">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold">Need a template?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Download our CSV template with example data and correct column
              headers.
            </p>
            <button
              onClick={downloadTemplate}
              className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Download Template
            </button>
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      {!result && (
        <div className="mb-6">
          <div
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              file
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload
              className={`mb-4 h-12 w-12 ${
                file ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <p className="mb-2 text-center font-medium">
              {file ? file.name : "Click to select a file"}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {file
                ? `Size: ${(file.size / 1024).toFixed(2)} KB`
                : "CSV or Excel file (max 5MB)"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {file && !importing && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleImport}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                Import Tasks
              </button>
              <button
                onClick={handleReset}
                className="rounded-md border border-input bg-background px-4 py-2 hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {importing && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Importing tasks...</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 rounded-md border border-destructive bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <h3 className="font-semibold text-destructive">Import Failed</h3>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-md border border-border bg-muted p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-600">
                  Import Complete
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Imported:</span>
                    <span className="ml-2 font-semibold">
                      {result.imported}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Skipped:</span>
                    <span className="ml-2 font-semibold">{result.skipped}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border p-4">
                <h3 className="font-semibold">
                  Errors ({result.errors.length})
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto p-4">
                <ul className="space-y-2">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">Row {err.row}:</span>{" "}
                      <span className="text-muted-foreground">{err.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Imported Tasks Preview */}
          {result.tasks.length > 0 && (
            <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border p-4">
                <h3 className="font-semibold">
                  Imported Tasks (showing first {result.tasks.length})
                </h3>
              </div>
              <div className="max-h-60 overflow-y-auto p-4">
                <ul className="space-y-2">
                  {result.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="flex-1">{task.name}</span>
                      <span className="text-muted-foreground">
                        {task.progress}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Import Another File
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-md border border-input bg-background px-4 py-2 hover:bg-accent"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Format Information */}
      <div className="mt-6 rounded-md border border-border bg-muted p-4">
        <h3 className="mb-2 font-semibold">CSV Format Requirements</h3>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            <strong>Column order:</strong> Tasks | Subtasks | Sprint | Details |
            Progress % | Assigned to | Deadline
          </p>
          <p>
            <strong>Required columns:</strong> Tasks, Progress %
          </p>
          <p>
            <strong>Optional columns:</strong> Subtasks, Sprint, Details,
            Assigned to, Deadline
          </p>
          <p>
            <strong>Tasks:</strong> Main task name (1-200 characters)
          </p>
          <p>
            <strong>Subtasks:</strong> Parent task name if this is a subtask
            (leave empty for root tasks)
          </p>
          <p>
            <strong>Progress %:</strong> Must be 0-100 (integer)
          </p>
          <p>
            <strong>Assigned to:</strong> User's name or email address
          </p>
          <p>
            <strong>Deadline:</strong> ISO 8601 (YYYY-MM-DD) or MM/DD/YYYY
            format
          </p>
          <p>
            <strong>Max rows:</strong> 10,000 tasks per file
          </p>
        </div>
      </div>

      {/* Conflict Resolution Modal */}
      {showConflictModal && noteConflicts.length > 0 && (
        <ConflictResolutionModal
          conflicts={noteConflicts}
          onResolve={handleResolveConflicts}
          onCancel={() => {
            setShowConflictModal(false);
            setNoteConflicts([]);
            setPendingImportData(null);
            handleReset();
          }}
        />
      )}
    </div>
  );
}
