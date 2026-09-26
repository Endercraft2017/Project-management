import { useState } from 'react';
import { MessageAttachment } from '@/types';
import { Table, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/utils/fileUtils';
import { CsvModal } from './CsvModal';

interface CsvPreviewProps {
  attachment: MessageAttachment;
}

export function CsvPreview({ attachment }: CsvPreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const downloadUrl = `/api/auth/drive/file/${attachment.driveFileId}`;

  return (
    <>
      <div
        className="group flex items-start gap-3 rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setIsModalOpen(true)}
      >
        {/* File Icon */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
          <Table className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>

        {/* File Info */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {attachment.fileName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(attachment.fileSize)} • CSV Spreadsheet
              </div>
            </div>
          </div>

          {/* Hover hint */}
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to view table
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1">
          <a
            href={downloadUrl}
            download={attachment.fileName}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex"
          >
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Download className="h-4 w-4" />
            </Button>
          </a>
          <a
            href={attachment.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex"
          >
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <CsvModal
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
