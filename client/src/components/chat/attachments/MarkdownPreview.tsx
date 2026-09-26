import { useState } from 'react';
import { MessageAttachment } from '@/types';
import { FileText } from 'lucide-react';
import { formatFileSize } from '@/utils/fileUtils';
import { MarkdownModal } from './MarkdownModal';

interface MarkdownPreviewProps {
  attachment: MessageAttachment;
}

export function MarkdownPreview({ attachment }: MarkdownPreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        className="group flex cursor-pointer items-center gap-3 rounded-lg border border-gray-300 bg-white p-3 transition-all hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-750"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            📝 {attachment.fileName}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Markdown • {formatFileSize(attachment.fileSize)}</span>
            <span className="opacity-0 transition-opacity group-hover:opacity-100">
              • Click to preview
            </span>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <MarkdownModal
          fileId={attachment.driveFileId}
          fileName={attachment.fileName}
          fileSize={attachment.fileSize}
          webViewLink={attachment.webViewLink}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
