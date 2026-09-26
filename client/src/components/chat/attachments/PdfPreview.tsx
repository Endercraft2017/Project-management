import { useState } from 'react';
import { MessageAttachment } from '@/types';
import { FileText, Download, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/utils/fileUtils';

interface PdfPreviewProps {
  attachment: MessageAttachment;
}

export function PdfPreview({ attachment }: PdfPreviewProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
        {/* PDF Icon */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
          <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>

        {/* File Info */}
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {attachment.fileName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            PDF • {formatFileSize(attachment.fileSize)}
          </div>

          {/* Action buttons */}
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowModal(true)}
            >
              <FileText className="mr-1 h-3 w-3" />
              Preview
            </Button>
            <a
              href={attachment.webContentLink || attachment.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Download className="mr-1 h-3 w-3" />
                Download
              </Button>
            </a>
            <a
              href={attachment.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative h-[90vh] w-[90vw] max-w-6xl rounded-lg bg-white dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {attachment.fileName}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* PDF Iframe */}
            <iframe
              src={attachment.webViewLink}
              className="h-[calc(90vh-57px)] w-full"
              title={attachment.fileName}
            />
          </div>
        </div>
      )}
    </>
  );
}
