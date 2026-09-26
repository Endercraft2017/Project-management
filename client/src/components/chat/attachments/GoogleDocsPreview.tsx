import { useState } from 'react';
import { MessageAttachment } from '@/types';
import { FileText, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/utils/fileUtils';

interface GoogleDocsPreviewProps {
  attachment: MessageAttachment;
}

export function GoogleDocsPreview({ attachment }: GoogleDocsPreviewProps) {
  const [showModal, setShowModal] = useState(false);

  // Determine icon based on file type
  const getIcon = () => {
    const mimeType = attachment.mimeType;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />;
    }
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />;
    }
    return <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />;
  };

  const getBackgroundColor = () => {
    const mimeType = attachment.mimeType;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return 'bg-green-100 dark:bg-green-900/30';
    }
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return 'bg-orange-100 dark:bg-orange-900/30';
    }
    return 'bg-blue-100 dark:bg-blue-900/30';
  };

  const getFileType = () => {
    const mimeType = attachment.mimeType;
    if (mimeType.includes('google-apps.document') || mimeType.includes('word')) {
      return 'Google Docs';
    }
    if (mimeType.includes('google-apps.spreadsheet') || mimeType.includes('excel')) {
      return 'Google Sheets';
    }
    if (mimeType.includes('google-apps.presentation') || mimeType.includes('powerpoint')) {
      return 'Google Slides';
    }
    if (mimeType.includes('word')) return 'Word Document';
    if (mimeType.includes('excel')) return 'Excel Spreadsheet';
    if (mimeType.includes('powerpoint')) return 'PowerPoint';
    return 'Document';
  };

  return (
    <>
      <div className="flex items-start gap-3 rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
        {/* Icon */}
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${getBackgroundColor()}`}
        >
          {getIcon()}
        </div>

        {/* File Info */}
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {attachment.fileName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {getFileType()} • {formatFileSize(attachment.fileSize)}
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

      {/* Preview Modal */}
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

            {/* Document Iframe */}
            <iframe
              src={`${attachment.webViewLink}&embedded=true`}
              className="h-[calc(90vh-57px)] w-full"
              title={attachment.fileName}
            />
          </div>
        </div>
      )}
    </>
  );
}
