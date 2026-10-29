/** Bounded in-memory parsing: authorization and quota reservation precede disk writes. */
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import fs from 'fs/promises';
import { fileUploadConfig } from '@/config';
import prisma from '@/database/client';
import {
  getTenantContext,
  runWithTenant,
  TenantContext,
} from '@/tenancy/context';
import { reserveStorage, releaseStorage } from '@/platform/usage';
import { requireDurableUploadStorage } from './storage-policy';
const root = path.resolve(
  path.isAbsolute(fileUploadConfig.uploadDir)
    ? fileUploadConfig.uploadDir
    : path.join(__dirname, '../..', fileUploadConfig.uploadDir),
);
const requestTenants = new WeakMap<Request, Readonly<TenantContext>>();
const allocations = new WeakMap<
  Express.Multer.File,
  { tenantId: string; bytes: number; path: string; created: boolean }
>();
const extensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
];
const mimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];
export const sanitizeFilename = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\./, '')
    .slice(0, 255) || 'file';
export function getUploadsDir(): string {
  const { id } = getTenantContext();
  if (!/^[a-f0-9-]{36}$/i.test(id))
    throw new Error('Invalid tenant storage context');
  return path.join(root, id);
}
export function assertTenantFilePath(value: string): string {
  const directory = getUploadsDir(),
    resolved = path.resolve(value);
  if (
    path.dirname(resolved) !== directory ||
    path.basename(resolved).startsWith('.')
  )
    throw new Error('File not found');
  return resolved;
}
export async function validateStoredFilePath(value: string): Promise<string> {
  const resolved = assertTenantFilePath(value);
  const [directory, file] = await Promise.all([
    fs.lstat(path.dirname(resolved)),
    fs.lstat(resolved),
  ]);
  if (directory.isSymbolicLink() || file.isSymbolicLink() || !file.isFile())
    throw new Error('File not found');
  return resolved;
}
function contentMatches(file: Express.Multer.File): boolean {
  const b = file.buffer,
    ext = path.extname(file.originalname).toLowerCase();
  if (!Buffer.isBuffer(b) || !b.length) return false;
  const starts = (hex: string) =>
    b.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'));
  if (ext === '.png')
    return file.mimetype === 'image/png' && starts('89504e470d0a1a0a');
  if (ext === '.jpg' || ext === '.jpeg')
    return file.mimetype === 'image/jpeg' && starts('ffd8ff');
  if (ext === '.gif')
    return (
      file.mimetype === 'image/gif' &&
      ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString())
    );
  if (ext === '.webp')
    return (
      file.mimetype === 'image/webp' &&
      b.subarray(0, 4).toString() === 'RIFF' &&
      b.subarray(8, 12).toString() === 'WEBP'
    );
  if (ext === '.pdf')
    return (
      file.mimetype === 'application/pdf' &&
      b.subarray(0, 5).toString() === '%PDF-'
    );
  if (ext === '.doc' || ext === '.xls')
    return (
      starts('d0cf11e0a1b11ae1') &&
      file.mimetype ===
        (ext === '.doc' ? 'application/msword' : 'application/vnd.ms-excel')
    );
  if (ext === '.docx' || ext === '.xlsx') {
    // Verify a ZIP central directory with the expected Office document namespace.
    if (!starts('504b0304')) return false;
    const text = b.toString('latin1');
    return (
      text.includes('[Content_Types].xml') &&
      text.includes(
        ext === '.docx' ? 'word/document.xml' : 'xl/workbook.xml',
      ) &&
      file.mimetype ===
        (ext === '.docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
  }
  if (ext === '.csv' || ext === '.txt')
    return (
      !b.includes(0) &&
      ['text/csv', 'text/plain', 'application/vnd.ms-excel'].includes(
        file.mimetype,
      ) &&
      !b.toString('utf8').includes('\ufffd')
    );
  return false;
}
async function activeUser(userId: string) {
  getTenantContext();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user?.isActive) throw new Error('Unauthorized');
}
const filter =
  (csvOnly: boolean) =>
  (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!req.isAuthenticated?.() || !req.user?.id)
      return cb(new Error('Unauthorized'));
    const tenant = requestTenants.get(req);
    if (!tenant) return cb(new Error('Unauthorized'));
    void runWithTenant(tenant, () => activeUser(req.user!.id))
      .then(() => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (
          !extensions.includes(ext) ||
          !mimeTypes.includes(file.mimetype) ||
          (csvOnly && !['.csv', '.xls', '.xlsx'].includes(ext))
        )
          return cb(new Error('Unsupported file type'));
        cb(null, true);
      })
      .catch(() => cb(new Error('Unauthorized')));
  };
function scopedParser(parser: multer.Multer): multer.Multer {
  // Multipart stream events need not inherit the HTTP middleware's ALS resource.
  // Capture the trusted context before parsing; re-enter it before controller next.
  return new Proxy(parser, {
    get(target, property) {
      const value = (target as any)[property];
      if (
        !['single', 'array', 'fields', 'none', 'any'].includes(String(property))
      )
        return value;
      return (...args: any[]) => {
        const handler = value.apply(target, args);
        return (req: Request, res: any, next: any) => {
          try {
            requireDurableUploadStorage(fileUploadConfig.uploadDir);
          } catch (error) {
            return next(error);
          }
          let tenant: Readonly<TenantContext>;
          try {
            tenant = getTenantContext();
            requestTenants.set(req, tenant);
          } catch {
            return next(new Error('Unauthorized'));
          }
          handler(req, res, (error: any) =>
            runWithTenant(tenant, () => next(error)),
          );
        };
      };
    },
  });
}
export const upload = scopedParser(
  multer({
    storage: multer.memoryStorage(),
    fileFilter: filter(false),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, parts: 12 },
  }),
);
export const uploadCSV = scopedParser(
  multer({
    storage: multer.memoryStorage(),
    fileFilter: filter(true),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10, parts: 12 },
  }),
);

export async function persistUpload(
  file: Express.Multer.File,
  userId: string,
): Promise<void> {
  requireDurableUploadStorage(fileUploadConfig.uploadDir);
  await activeUser(userId);
  if (
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length > 10 * 1024 * 1024 ||
    !contentMatches(file)
  )
    throw new Error('Unsupported file type or content');
  const tenant = getTenantContext(),
    bytes = file.buffer.length;
  const directory = getUploadsDir(),
    filename = `v1-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
  const target = path.join(directory, filename);
  await reserveStorage(tenant.id, bytes);
  const allocation = {
    tenantId: tenant.id,
    bytes,
    path: target,
    created: false,
  };
  allocations.set(file, allocation);
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    if ((await fs.lstat(directory)).isSymbolicLink())
      throw new Error('Invalid storage directory');
    const handle = await fs.open(target, 'wx', 0o600);
    allocation.created = true;
    try {
      await handle.writeFile(file.buffer);
    } finally {
      await handle.close();
    }
    Object.assign(file, {
      destination: directory,
      filename,
      path: target,
      size: bytes,
    });
    file.buffer = undefined;
  } catch (error) {
    await cleanupUpload(file);
    throw error;
  }
}
export async function cleanupUpload(file: Express.Multer.File): Promise<void> {
  const allocation = allocations.get(file);
  if (!allocation) return;
  if (getTenantContext().id !== allocation.tenantId)
    throw new Error('Invalid storage context');
  if (allocation.created)
    await fs
      .unlink(assertTenantFilePath(allocation.path))
      .catch((error: any) => {
        if (error.code !== 'ENOENT') throw error;
      });
  // Release only this allocation, once. Failed cleanup stays charged, failing closed.
  allocations.delete(file); // An uncertain release must never be retried against other allocations.
  await releaseStorage(allocation.tenantId, allocation.bytes);
}
