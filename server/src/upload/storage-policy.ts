import path from 'node:path';

/** Operator confirmation is required; a path alone does not prove durability. */
export function uploadsEnabled(uploadDir = process.env.UPLOAD_DIR): boolean {
  return process.env.NODE_ENV !== 'production' || (
    process.env.STORAGE_PERSISTENCE_CONFIRMED === 'true' &&
    typeof uploadDir === 'string' && path.isAbsolute(uploadDir)
  );
}

export class UploadStorageUnavailable extends Error {
  readonly status = 503;
  readonly code = 'UPLOAD_STORAGE_UNAVAILABLE';
  constructor() {
    super('File uploads are unavailable until durable storage is configured. Contact your operator.');
  }
}

export function requireDurableUploadStorage(uploadDir: string): void {
  if (!uploadsEnabled(uploadDir)) throw new UploadStorageUnavailable();
}
