/**
 * File Utility Functions for File Attachments
 */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function isMarkdownFile(mimeType: string): boolean {
  return mimeType === 'text/markdown' || mimeType === 'text/x-markdown';
}

export function isCsvFile(mimeType: string, fileName?: string): boolean {
  return (
    mimeType === 'text/csv' ||
    mimeType === 'application/csv' ||
    (fileName && fileName.toLowerCase().endsWith('.csv'))
  );
}

export function isTextFile(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript')
  );
}

export function isGoogleDocsFile(mimeType: string): boolean {
  return (
    mimeType.includes('vnd.google-apps') ||
    mimeType.includes('vnd.openxmlformats-officedocument')
  );
}

export function getFileIcon(mimeType: string): string {
  if (isImageFile(mimeType)) return '🖼️';
  if (isPdfFile(mimeType)) return '📄';
  if (isMarkdownFile(mimeType)) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return '📽️';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📃';
  if (mimeType.includes('video')) return '🎥';
  if (mimeType.includes('audio')) return '🎵';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
  return '📎';
}
