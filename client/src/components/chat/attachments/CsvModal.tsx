import { useEffect, useState } from 'react';
import { X, Download, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CsvModalProps {
  fileId: string;
  fileName: string;
  fileSize: number;
  webViewLink: string;
  onClose: () => void;
}

export function CsvModal({ fileId, fileName, fileSize, webViewLink, onClose }: CsvModalProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const downloadUrl = `/api/auth/drive/file/${fileId}`;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    // Load file content
    loadContent();

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, fileId]);

  const loadContent = async () => {
    try {
      const response = await fetch(downloadUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load file');
      }

      const text = await response.text();
      setContent(text);
    } catch (err: any) {
      console.error('[CsvModal] Error loading file:', err);
      setError(err.message || 'Failed to load file content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[CsvModal] Failed to copy:', err);
    }
  };

  // Parse CSV
  const parseCSV = (csv: string): string[][] => {
    const lines = csv.trim().split('\n');
    return lines.map(line => {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      return row;
    });
  };

  const rows = content ? parseCSV(content) : [];
  const headers = rows.length > 0 ? rows[0] : [];
  const dataRows = rows.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex-1 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {fileName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(fileSize / 1024).toFixed(1)} KB
              {dataRows.length > 0 && ` • ${dataRows.length} rows × ${headers.length} columns`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-4">
            {content && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            )}
            <a
              href={downloadUrl}
              download={fileName}
              className="inline-flex"
            >
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </a>
            <a
              href={webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Drive
              </Button>
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-600 dark:text-red-400">{error}</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                {/* Header */}
                <thead className="bg-gray-200 dark:bg-gray-800">
                  <tr>
                    {headers.map((header, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 border-b-2 border-gray-300 dark:border-gray-600"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                {/* Body */}
                <tbody>
                  {dataRows.map((row, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          Press ESC to close
        </div>
      </div>
    </div>
  );
}
