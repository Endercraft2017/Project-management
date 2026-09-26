/**
 * Missing Updates Settings Button (Admin Only)
 * Opens a dialog to configure missing updates tracking settings
 */

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { MissingUpdatesConfigCard as ConfigCard } from './MissingUpdatesConfig';

export default function MissingUpdatesSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        title="Configure Missing Updates Tracking"
      >
        <Settings className="h-4 w-4" />
        Updates Settings
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <ConfigCard onClose={() => setIsOpen(false)} />
        </div>
      </div>
    </>
  );
}
