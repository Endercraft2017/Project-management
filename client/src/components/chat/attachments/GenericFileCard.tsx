import { MessageAttachment } from '@/types';
import { File, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize, getFileIcon } from '@/utils/fileUtils';

interface GenericFileCardProps {
  attachment: MessageAttachment;
}

export function GenericFileCard({ attachment }: GenericFileCardProps) {
  // Construct download URL from driveFileId (works for all files, even if webContentLink is missing)
  const downloadUrl = attachment.webContentLink ||
    `https://drive.google.com/uc?export=download&id=${attachment.driveFileId}`;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
      {/* File Icon */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
        {attachment.iconLink ? (
          <img
            src={attachment.iconLink}
            alt="File icon"
            className="h-8 w-8"
            onError={(e) => {
              // Fallback to lucide icon if image fails
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : (
          <File className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        )}
        <File className="hidden h-6 w-6 text-gray-600 dark:text-gray-400" />
      </div>

      {/* File Info */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getFileIcon(attachment.mimeType)}</span>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {attachment.fileName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(attachment.fileSize)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-2 flex gap-2">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={attachment.fileName}
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
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <ExternalLink className="mr-1 h-3 w-3" />
              Open in Drive
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
