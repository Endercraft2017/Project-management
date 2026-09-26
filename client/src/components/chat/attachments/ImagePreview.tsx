import { useState } from 'react';
import { ImageModal } from './ImageModal';
import { MessageAttachment } from '@/types';
import { ExternalLink } from 'lucide-react';

interface ImagePreviewProps {
  attachment: MessageAttachment;
}

export function ImagePreview({ attachment }: ImagePreviewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Use backend proxy to serve Drive files with authentication
  // This avoids CORS and authentication issues
  const imageUrl = `/api/auth/drive/file/${attachment.driveFileId}`;

  if (imageError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
        <span className="text-2xl">🖼️</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {attachment.fileName}
          </div>
          <div className="text-xs text-gray-500">Image preview unavailable</div>
        </div>
        <a
          href={attachment.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </a>
      </div>
    );
  }

  return (
    <>
      <div
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800"
        style={{ maxWidth: '400px' }}
        onClick={() => setIsModalOpen(true)}
      >
        <img
          src={imageUrl}
          alt={attachment.fileName}
          className="h-auto w-full object-cover transition-transform duration-200 group-hover:scale-105"
          onError={() => setImageError(true)}
          loading="lazy"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/40">
          <div className="translate-y-4 text-sm font-medium text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            Click to view full size
          </div>
        </div>

        {/* File name caption */}
        <div className="bg-white/90 px-2 py-1 text-xs text-gray-700 dark:bg-gray-900/90 dark:text-gray-300">
          {attachment.fileName}
        </div>
      </div>

      {/* Full-size modal */}
      {isModalOpen && (
        <ImageModal
          imageUrl={imageUrl}
          imageName={attachment.fileName}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
