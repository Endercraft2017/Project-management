/**
 * Response headers for Drive files proxied through this server.
 *
 * Proxied files are served from the app's own origin, so anything a browser
 * could execute (HTML, SVG, XML, JavaScript, ...) must never render inline.
 */

import type { Response } from 'express';

// Types that are safe to display inline: browsers render them without running script
const INLINE_SAFE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
]);

/** Drive file IDs are URL-safe base64-like strings */
export function isValidDriveFileId(fileId: string): boolean {
  return /^[A-Za-z0-9_-]{10,200}$/.test(fileId);
}

/** RFC 6266 Content-Disposition with an ASCII fallback and a UTF-8 filename */
export function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function setDriveFileHeaders(
  res: Response,
  mimeType: string | null | undefined,
  name: string | null | undefined
): void {
  const type = (mimeType || 'application/octet-stream').toLowerCase();
  const filename = name || 'file';
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (type === 'image/svg+xml') {
    // <img> renders SVG without running its scripts; opening the URL directly
    // downloads it, and the sandbox blocks script if a browser renders it anyway
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', contentDisposition('attachment', filename));
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  } else {
    const inline = INLINE_SAFE_TYPES.has(type);
    // Text types render as plain text only, never as markup
    const contentType = type.startsWith('text/') ? 'text/plain; charset=utf-8' : type;

    res.setHeader('Content-Type', inline ? contentType : 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', filename));
  }

  // Files can be private to the viewer: never let shared caches store them
  res.setHeader('Cache-Control', 'private, max-age=3600');
}
