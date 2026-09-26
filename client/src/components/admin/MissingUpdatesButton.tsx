/**
 * Admin Button: Missing Updates Tracker
 * Shows button that opens modal with users who have missing daily updates
 * Only visible to admins
 */

import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useUsers';
import { MissingUpdatesModal } from './MissingUpdatesModal';
import { AlertCircle } from 'lucide-react';

export function MissingUpdatesButton() {
  const { data: currentUser } = useCurrentUser();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only show to admins
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        <AlertCircle className="h-4 w-4" />
        Missing Updates
      </button>

      <MissingUpdatesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
