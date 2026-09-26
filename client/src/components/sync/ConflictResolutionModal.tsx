/**
 * Conflict Resolution Modal
 * Allows users to resolve note conflicts when importing CSV with duplicates
 */

import { useState } from 'react';
import { X } from 'lucide-react';

interface NoteConflict {
  taskId: string;
  taskName: string;
  reason: string;
  dbDetails: string;
  csvDetails: string;
}

interface ConflictResolution {
  taskId: string;
  resolution: 'useDb' | 'useSheet' | 'merge';
}

interface ConflictResolutionModalProps {
  conflicts: NoteConflict[];
  onResolve: (resolutions: ConflictResolution[]) => void;
  onCancel: () => void;
}

export default function ConflictResolutionModal({
  conflicts,
  onResolve,
  onCancel,
}: ConflictResolutionModalProps) {
  const [resolutions, setResolutions] = useState<Record<string, 'useDb' | 'useSheet' | 'merge'>>(
    {}
  );

  const handleResolutionChange = (taskId: string, resolution: 'useDb' | 'useSheet' | 'merge') => {
    setResolutions((prev) => ({
      ...prev,
      [taskId]: resolution,
    }));
  };

  const handleSubmit = () => {
    // Check if all conflicts are resolved
    const unresolvedConflicts = conflicts.filter((c) => !resolutions[c.taskId]);
    if (unresolvedConflicts.length > 0) {
      alert(`Please resolve all conflicts before continuing. ${unresolvedConflicts.length} remaining.`);
      return;
    }

    const resolvedConflicts: ConflictResolution[] = conflicts.map((conflict) => ({
      taskId: conflict.taskId,
      resolution: resolutions[conflict.taskId],
    }));

    onResolve(resolvedConflicts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-xl font-semibold">Resolve Note Conflicts</h2>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <p className="mb-4 text-sm text-muted-foreground">
            The following tasks have different notes in the database and CSV file. Please choose how to resolve each conflict.
          </p>

          <div className="space-y-6">
            {conflicts.map((conflict) => (
              <div key={conflict.taskId} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="mb-3">
                  <h3 className="font-semibold text-lg">{conflict.taskName}</h3>
                  <p className="text-sm text-muted-foreground">{conflict.reason}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Current (DB) Notes */}
                  <div className="rounded-lg border border-border bg-background p-3">
                    <h4 className="mb-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                      Current Notes (Database)
                    </h4>
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {conflict.dbDetails || <span className="italic text-muted-foreground">(empty)</span>}
                    </div>
                  </div>

                  {/* New (CSV) Notes */}
                  <div className="rounded-lg border border-border bg-background p-3">
                    <h4 className="mb-2 text-sm font-medium text-green-600 dark:text-green-400">
                      New Notes (CSV)
                    </h4>
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {conflict.csvDetails || <span className="italic text-muted-foreground">(empty)</span>}
                    </div>
                  </div>
                </div>

                {/* Resolution Options */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleResolutionChange(conflict.taskId, 'useDb')}
                    className={`flex-1 min-w-[150px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      resolutions[conflict.taskId] === 'useDb'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-border bg-background text-foreground hover:bg-accent'
                    }`}
                  >
                    Keep Current (DB)
                  </button>
                  <button
                    onClick={() => handleResolutionChange(conflict.taskId, 'useSheet')}
                    className={`flex-1 min-w-[150px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      resolutions[conflict.taskId] === 'useSheet'
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-border bg-background text-foreground hover:bg-accent'
                    }`}
                  >
                    Use New (CSV)
                  </button>
                  <button
                    onClick={() => handleResolutionChange(conflict.taskId, 'merge')}
                    className={`flex-1 min-w-[150px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      resolutions[conflict.taskId] === 'merge'
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-border bg-background text-foreground hover:bg-accent'
                    }`}
                  >
                    Merge Both
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-6 py-4">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply Resolutions ({Object.keys(resolutions).length}/{conflicts.length})
          </button>
        </div>
      </div>
    </div>
  );
}
