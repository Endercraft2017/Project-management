import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageModalProps {
  imageUrl: string;
  imageName: string;
  onClose: () => void;
}

export function ImageModal({ imageUrl, imageName, onClose }: ImageModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute -right-2 -top-2 z-10 h-8 w-8 rounded-full bg-white p-0 shadow-lg hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Image */}
        <img
          src={imageUrl}
          alt={imageName}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />

        {/* Image name caption */}
        <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/40 backdrop-blur-sm px-4 py-2 text-center text-sm text-white">
          {imageName}
        </div>
      </div>
    </div>
  );
}
