import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import request from 'supertest';
import {runWithTenant, getTenantContext} from '@/tenancy/context';
import * as uploads from '../multer-config';
import * as service from '../service';
import * as usage from '@/platform/usage';
import { handleMulterError } from '../controller';
import { uploadsEnabled } from '../storage-policy';
const mockRoot = '/tmp/ez-upload-tests-' + process.pid;
let mockUsed = 0,
  mockLimit = 1024,
  mockCreateError = false,
  mockRecord: any = null,
  mockDeleted = false,
  mockReleaseError = false;
jest.mock('@/tasks/service', () => ({ taskService: { createTask: jest.fn(), createSubtask: jest.fn() } }));
jest.mock('@/config', () => ({ fileUploadConfig: { uploadDir: '/tmp/ez-upload-tests-' + process.pid } }));
jest.mock('@/platform/usage', () => ({
  reserveStorage: jest.fn(async (_: any, n: number) => {
    if (mockUsed + n > mockLimit)
      throw Object.assign(new Error('Storage quota exceeded'), { status: 413 });
    mockUsed += n;
  }),
  releaseStorage: jest.fn(async (_: any, n: number) => {
    mockUsed -= n;
    if (mockReleaseError) throw new Error('Uncertain release');
  }),
}));
jest.mock('@/database/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: async () => ({ id: 'user', isActive: true, role: 'MEMBER' }),
    },
    conversation: { findUnique: async () => null },
    file: {
      create: async ({ data }: any) => {
        if (mockCreateError) throw new Error('Metadata failed');
        return {
          ...data,
          id: 'file',
          uploadedBy: { id: 'user' },
          createdAt: new Date(),
        };
      },
      findUnique: async () => mockRecord,
      deleteMany: async () => {
        if (mockDeleted) return { count: 0 };
        mockDeleted = true;
        return { count: 1 };
      },
    },
  },
}));
const tenant = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'A0000Z',
  name: 'A',
  schemaName: 'ez_t_aaaaaaaaaaaaaaaa',
  status: 'ACTIVE' as const,
};
const file = (text = 'demo'): Express.Multer.File => ({
  originalname: 'sample.txt',
  mimetype: 'text/plain',
  buffer: Buffer.from(text),
  size: Buffer.byteLength(text),
} as Express.Multer.File);
beforeEach(async () => {
  mockUsed = 0;
  mockLimit = 1024;
  mockCreateError = false;
  mockRecord = null;
  mockDeleted = false;
  mockReleaseError = false;
  jest.clearAllMocks();
  await fs.rm(mockRoot, { recursive: true, force: true });
});
afterAll(() => fs.rm(mockRoot, { recursive: true, force: true }));
test('writes use actual counted bytes inside the selected tenant path', async () => {
  const f = file('hello');
  const result = await runWithTenant(tenant, () =>
    service.uploadFile(f, 'user'),
  );
  expect(mockUsed).toBe(5);
  expect(path.dirname(f.path)).toBe(path.join(mockRoot, tenant.id));
  expect(await fs.readFile(f.path, 'utf8')).toBe('hello');
  expect(result.filename).toBe('sample.txt');
});
test('quota failure occurs before directory/file writes', async () => {
  mockLimit = 2;
  await expect(
    runWithTenant(tenant, () => service.uploadFile(file('hello'), 'user')),
  ).rejects.toMatchObject({ status: 413 });
  expect(mockUsed).toBe(0);
  await expect(fs.stat(mockRoot)).rejects.toMatchObject({ code: 'ENOENT' });
});
test('forbidden chat attachment never reserves or writes', async () => {
  await expect(
    runWithTenant(tenant, () =>
      service.uploadChatAttachment(file(), 'user', 'private-conversation'),
    ),
  ).rejects.toThrow('Conversation not found');
  expect(usage.reserveStorage).not.toHaveBeenCalled();
  await expect(fs.stat(mockRoot)).rejects.toMatchObject({ code: 'ENOENT' });
});
test('database metadata failure removes this file and releases only its reservation', async () => {
  mockCreateError = true;
  await expect(
    runWithTenant(tenant, () => service.uploadFile(file('hello'), 'user')),
  ).rejects.toThrow('Metadata failed');
  expect(mockUsed).toBe(0);
  expect(await fs.readdir(path.join(mockRoot, tenant.id))).toEqual([]);
  expect(usage.releaseStorage).toHaveBeenCalledTimes(1);
});
test('CSV validation failure cleans temporary allocation and quota', async () => {
  const f = {
    ...file('wrong,headers\nvalue,here\n'),
    originalname: 'invalid.csv',
    mimetype: 'text/csv',
  };
  await expect(
    runWithTenant(tenant, () => service.importTasksFromFile(f, 'user')),
  ).rejects.toThrow('Missing required columns');
  expect(mockUsed).toBe(0);
  await expect(fs.stat(f.path)).rejects.toMatchObject({ code: 'ENOENT' });
});
test('spoofed content is rejected before reservation', async () => {
  const f = {
    ...file('not a png'),
    originalname: 'image.png',
    mimetype: 'image/png',
  };
  await expect(
    runWithTenant(tenant, () => service.uploadFile(f, 'user')),
  ).rejects.toThrow('Unsupported');
  expect(usage.reserveStorage).not.toHaveBeenCalled();
});
test('stored paths cannot cross into another tenant directory', async () => {
  mockRecord = {
    id: 'file',
    uploadedById: 'user',
    path: path.join(
      mockRoot,
      '22222222-2222-4222-8222-222222222222',
      'v1-file.txt',
    ),
    conversation: null,
  };
  await expect(
    runWithTenant(tenant, () => service.getFileById('file', 'user')),
  ).rejects.toThrow('File not found');
});
test('symlink files fail before reads/deletes', async () => {
  const dir = path.join(mockRoot, tenant.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(mockRoot, 'outside.txt'), 'not this tenant');
  await fs.symlink(
    path.join(mockRoot, 'outside.txt'),
    path.join(dir, 'v1-link.txt'),
  );
  await expect(
    runWithTenant(tenant, () =>
      uploads.validateStoredFilePath(path.join(dir, 'v1-link.txt')),
    ),
  ).rejects.toThrow('File not found');
  expect(await fs.readFile(path.join(mockRoot, 'outside.txt'), 'utf8')).toBe(
    'not this tenant',
  );
});
test('concurrent deletes cannot release storage twice', async () => {
  const f = file('abc');
  await runWithTenant(tenant, () => uploads.persistUpload(f, 'user'));
  mockRecord = {
    id: 'file',
    uploadedById: 'user',
    path: f.path,
    storedFilename: f.filename,
    size: f.size,
  };
  mockUsed += 5;
  const results = await runWithTenant(tenant, () =>
    Promise.allSettled([
      service.deleteFile('file', 'user'),
      service.deleteFile('file', 'user'),
    ]),
  );
  expect(results.filter((x: any) => x.status === 'fulfilled')).toHaveLength(1);
  expect(usage.releaseStorage).toHaveBeenCalledTimes(1);
  expect(mockUsed).toBe(5);
});
test('uncertain cleanup release is never replayed against other storage', async () => {
  const f = file('abc');
  await runWithTenant(tenant, () => uploads.persistUpload(f, 'user'));
  mockUsed += 5;
  mockReleaseError = true;
  await expect(
    runWithTenant(tenant, () => uploads.cleanupUpload(f)),
  ).rejects.toThrow('Uncertain release');
  await runWithTenant(tenant, () => uploads.cleanupUpload(f));
  expect(usage.releaseStorage).toHaveBeenCalledTimes(1);
  expect(mockUsed).toBe(5);
});
test('multipart async callback restores ALS before the controller', async () => {
  const app = express();
  app.use((req: any, _: any, next: any) => {
    req.user = { id: 'user' };
    req.isAuthenticated = () => true;
    runWithTenant(tenant, next);
  });
  app.post('/', uploads.upload.single('file'), (req: any, res: any) =>
    res.json({
      tenant: getTenantContext().id,
      memory: Buffer.isBuffer(req.file.buffer),
      path: req.file.path || null,
    }),
  );
  const response = await request(app)
    .post('/')
    .attach('file', Buffer.from('hello'), {
      filename: 'sample.txt',
      contentType: 'text/plain',
    });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    tenant: tenant.id,
    memory: true,
    path: null,
  });
  expect(usage.reserveStorage).not.toHaveBeenCalled();
});

describe('production durable-storage admission', () => {
  let previousNodeEnv: string | undefined;
  let previousConfirmation: string | undefined;
  beforeEach(() => {
    previousNodeEnv = process.env.NODE_ENV;
    previousConfirmation = process.env.STORAGE_PERSISTENCE_CONFIRMED;
    process.env.NODE_ENV = 'production';
    delete process.env.STORAGE_PERSISTENCE_CONFIRMED;
  });
  afterEach(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousConfirmation === undefined) delete process.env.STORAGE_PERSISTENCE_CONFIRMED;
    else process.env.STORAGE_PERSISTENCE_CONFIRMED = previousConfirmation;
  });

  test('rejects before multipart parsing, controller work, reservation or disk writes', async () => {
    const controller = jest.fn((_req, res) => res.json({ success: true }));
    const app = express();
    app.use((req: any, _res, next) => {
      req.user = { id: 'user' };
      req.isAuthenticated = () => true;
      runWithTenant(tenant, next);
    });
    app.post('/', uploads.upload.single('file'), controller);
    app.use(handleMulterError);
    const response = await request(app).post('/').attach('file', Buffer.from('invalid'), {
      filename: 'unsupported.exe', contentType: 'application/octet-stream',
    });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: 'UPLOAD_STORAGE_UNAVAILABLE',
      message: 'File uploads are unavailable until durable storage is configured. Contact your operator.',
    });
    expect(controller).not.toHaveBeenCalled();
    expect(usage.reserveStorage).not.toHaveBeenCalled();
    await expect(fs.stat(mockRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('direct persistence cannot bypass the production guard', async () => {
    const f = file('hello');
    await expect(runWithTenant(tenant, () => uploads.persistUpload(f, 'user')))
      .rejects.toMatchObject({ status: 503, code: 'UPLOAD_STORAGE_UNAVAILABLE' });
    expect(usage.reserveStorage).not.toHaveBeenCalled();
    expect(f.buffer.toString()).toBe('hello');
    await expect(fs.stat(mockRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('confirmation plus an absolute path permits configured production storage', async () => {
    process.env.STORAGE_PERSISTENCE_CONFIRMED = 'true';
    expect(uploadsEnabled('/private/uploads')).toBe(true);
    expect(uploadsEnabled('uploads')).toBe(false);
    expect(uploadsEnabled('')).toBe(false);
    const f = file('durable');
    await runWithTenant(tenant, () => uploads.persistUpload(f, 'user'));
    expect(await fs.readFile(f.path, 'utf8')).toBe('durable');
    expect(mockUsed).toBe(7);
  });

  test('a truthy-looking flag does not confirm persistence', () => {
    process.env.STORAGE_PERSISTENCE_CONFIRMED = 'false';
    expect(uploadsEnabled('/private/uploads')).toBe(false);
  });

  test('authorized reads remain available while new uploads are refused', async () => {
    const directory = path.join(mockRoot, tenant.id);
    const target = path.join(directory, 'v1-existing.txt');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(target, 'existing');
    mockRecord = { id: 'file', uploadedById: 'user', path: target, conversation: null };
    const result = await runWithTenant(tenant, () => service.getFileById('file', 'user'));
    expect(await fs.readFile(result.path, 'utf8')).toBe('existing');
    expect(usage.reserveStorage).not.toHaveBeenCalled();
  });
});

export {};
