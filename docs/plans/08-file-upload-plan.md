# Feature 8: File Upload System - Implementation Plan

**Status**: Ready for Implementation
**Estimated Time**: 4 hours
**Dependencies**: Features 1-2 (Database, Authentication), Feature 7 (Chat)
**Last Updated**: 2025-10-10

---

## Table of Contents

1. [Research Summary](#research-summary)
2. [Feature Overview](#feature-overview)
3. [Architecture Design](#architecture-design)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Implementation Plan](#implementation-plan)
7. [Security Considerations](#security-considerations)
8. [Testing Strategy](#testing-strategy)
9. [Performance Considerations](#performance-considerations)

---

## Research Summary

### Multer Best Practices (2025)

**Key Findings**:

1. **File Type Validation**: Use `fileFilter` function with MIME type AND extension validation
2. **File Size Limits**: Implement strict limits (5MB for general uploads, 10MB for CSV/Excel)
3. **Rate Limiting**: Prevent DoS attacks via express-rate-limit
4. **Storage**: Local disk storage for development, cloud (S3/GCS) for production
5. **Security**: Validate MIME type, magic bytes, sanitize filenames, isolate storage
6. **Error Handling**: Handle file size exceeded, unsupported types, disk full errors
7. **Memory Storage**: Avoid for large files (causes RAM overload)
8. **Path Traversal**: Never use original filename directly, always sanitize

### CSV/Excel Parsing

**Libraries**:
- **PapaParse**: Fast CSV parser, auto-detects delimiters, stream support, 0 dependencies
- **XLSX (SheetJS)**: Excel parser, supports .xlsx/.xls, widely used (5500+ projects)

**Best Practices**:
- Validate row count (max 10,000 rows for task import)
- Validate column headers match expected format
- Type coercion for numbers/booleans
- Handle malformed data gracefully
- Stream large files to avoid memory issues

### Security Considerations

**OWASP File Upload Guidelines**:
1. **Whitelist Approach**: Only allow specific file types
2. **MIME Type**: Validate but don't rely solely on it (can be spoofed)
3. **Magic Bytes**: Check file signature (first few bytes)
4. **Filename Sanitization**: Remove special characters, path separators
5. **File Size**: Enforce strict limits
6. **Virus Scanning**: Optional but recommended for production
7. **Isolated Storage**: Store outside web root, serve via dedicated script
8. **Content Disarm**: For PDFs/DOCX, strip potentially malicious content

### Storage Strategy

**Development**: Local disk storage (`uploads/` directory)
**Production**: AWS S3 / Google Cloud Storage / Azure Blob Storage

**Why Cloud Storage**:
- Cost: $0.023/GB/month
- Scalability: No server storage limits
- Backups: Automatic versioning
- Security: Access control, encryption
- CDN: Fast delivery via edge locations

---

## Feature Overview

### User Stories

1. **As a user**, I want to upload CSV/Excel files to bulk import tasks
2. **As a user**, I want to send file attachments in chat conversations
3. **As an admin**, I want to set file upload limits
4. **As a user**, I want to see upload progress
5. **As a user**, I want to download previously uploaded files

### Core Functionality

**Generic File Upload**:
- Upload any file (within size/type limits)
- Store metadata in database
- Return file URL for access

**CSV/Excel Task Import**:
- Upload CSV/Excel file
- Parse and validate task data
- Create tasks in database
- Return import results (success/error counts)

**Chat Attachments**:
- Upload files with messages
- Support images, PDFs, documents
- Thumbnail generation for images
- Link to conversation/message

**File Management**:
- List uploaded files
- Download files
- Delete files (owner/admin only)
- Track upload date, size, type

---

## Architecture Design

### File Structure

```
server/src/upload/
├── multer-config.ts       # Multer configuration & file filter
├── storage.ts             # Storage abstraction (disk/S3)
├── parser.ts              # CSV/Excel parsing logic
├── validators.ts          # Zod validation schemas
├── service.ts             # Upload business logic
├── controller.ts          # REST API controllers
└── routes.ts              # REST API routes
```

### Technology Stack

- **Multer**: File upload middleware
- **PapaParse**: CSV parsing
- **XLSX**: Excel parsing
- **Sharp**: Image processing (optional)
- **AWS SDK / GCS SDK**: Cloud storage (production)
- **Zod**: Input validation

### Data Flow

```
Client → Multer Middleware → File Filter → Disk Storage → Service → Database
                                                         → Parse CSV → Create Tasks
                                                         → Link to Chat Message
```

---

## Database Schema

### File Model (New)

```prisma
model File {
  id              String    @id @default(uuid())
  filename        String    // Original filename (sanitized)
  storedFilename  String    // Generated unique filename
  mimeType        String
  size            Int       // Bytes
  path            String    // Storage path or S3 key
  uploadedById    String
  conversationId  String?   // For chat attachments
  messageId       String?   // For chat attachments
  createdAt       DateTime  @default(now())

  uploadedBy      User         @relation(fields: [uploadedById], references: [id], onDelete: Restrict)
  conversation    Conversation? @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  message         Message?      @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([uploadedById])
  @@index([conversationId])
  @@index([messageId])
  @@index([createdAt])
  @@map("files")
}
```

### Update Message Model

```prisma
model Message {
  // ... existing fields ...

  // Add relation
  attachments File[]
}
```

---

## API Endpoints

### 1. Upload Generic File

```
POST /api/upload
```

**Request**: `multipart/form-data`

```
file: <binary>
```

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1024576,
    "url": "/api/upload/download/uuid",
    "createdAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Max size: 5MB
- Allowed types: images (jpg, png, gif), PDF, docs (doc, docx), spreadsheets (xls, xlsx, csv)
- Filename sanitized (remove special chars, path separators)
- Stored with generated UUID filename
- Authenticated users only

**Errors**:
- 400: File too large, unsupported type
- 401: Not authenticated
- 413: Payload too large
- 500: Upload failed

---

### 2. Upload & Parse CSV/Excel for Task Import

```
POST /api/upload/tasks-import
```

**Request**: `multipart/form-data`

```
file: <CSV or XLSX file>
```

**Expected CSV Format**:

```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
"Task 1","Description",50,"Sprint 1","john@servicebay.ai","2025-01-01","2025-01-31",0,
"Subtask 1.1","Details",25,"Sprint 1","jane@servicebay.ai","2025-01-02","2025-01-15",1,"parent-task-id"
```

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "imported": 45,
    "skipped": 5,
    "errors": [
      {
        "row": 3,
        "error": "Invalid email for 'Assigned To': invalid@example.com"
      }
    ],
    "tasks": [
      {
        "id": "uuid",
        "name": "Task 1",
        "progress": 50
      }
    ]
  }
}
```

**Validation Rules**:
- Max 10,000 rows
- Required columns: "Task Name", "Progress", "Nesting Level"
- Optional: Details, Sprint, Assigned To, Start Date, Deadline, Parent ID
- Progress: 0-100
- Nesting Level: 0-3
- Emails must match existing users
- Dates: ISO 8601 or MM/DD/YYYY format
- Parent ID must exist for nested tasks

**Errors**:
- 400: Invalid CSV format, validation errors
- 401: Not authenticated
- 403: Only admins can import tasks
- 413: File too large (max 10MB)

---

### 3. Upload Chat Attachment

```
POST /api/upload/chat-attachment
```

**Request**: `multipart/form-data`

```
file: <binary>
conversationId: uuid
```

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "screenshot.png",
    "mimeType": "image/png",
    "size": 245760,
    "url": "/api/upload/download/uuid",
    "conversationId": "conv-uuid",
    "createdAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- Max size: 5MB
- Allowed types: images, PDF, docs, spreadsheets
- User must be a member of the conversation
- File linked to conversation (messageId set when message created)
- Auto-thumbnail generation for images (optional)

**Errors**:
- 400: Invalid conversationId, file too large
- 401: Not authenticated
- 403: Not a member of conversation
- 413: Payload too large

---

### 4. Download File

```
GET /api/upload/download/:id
```

**Response**: `200 OK`

```
Content-Type: <file MIME type>
Content-Disposition: attachment; filename="<sanitized-filename>"

<binary data>
```

**Business Rules**:
- User must be the uploader OR member of conversation (for chat attachments)
- Sets appropriate headers for download
- Streams file (doesn't load into memory)

**Errors**:
- 401: Not authenticated
- 403: Not authorized to access file
- 404: File not found

---

### 5. List Uploaded Files

```
GET /api/upload/files
```

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `conversationId` | string | No | - | Filter by conversation |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Results per page (max 100) |

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "uuid",
        "filename": "document.pdf",
        "mimeType": "application/pdf",
        "size": 1024576,
        "url": "/api/upload/download/uuid",
        "uploadedBy": {
          "id": "uuid",
          "name": "John Doe"
        },
        "conversationId": null,
        "createdAt": "2025-10-10T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 134,
      "pages": 7
    }
  }
}
```

---

### 6. Delete File

```
DELETE /api/upload/:id
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Business Rules**:
- User must be the uploader OR admin
- Deletes from disk/S3 AND database
- Cascade deletes if linked to message

**Errors**:
- 401: Not authenticated
- 403: Not authorized (not owner or admin)
- 404: File not found

---

## Implementation Plan

### Step 1: Database Migration (15 min)

**File**: `server/database/prisma/schema.prisma`

Add File model and update Message model.

```bash
npx prisma migrate dev --name add-file-model
npx prisma generate
```

---

### Step 2: Multer Configuration (30 min)

**File**: `server/src/upload/multer-config.ts`

```typescript
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// File filter
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Separate instance for CSV/Excel (higher limit)
export const uploadCSV = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const csvMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (csvMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});
```

---

### Step 3: Validation Schemas (20 min)

**File**: `server/src/upload/validators.ts`

```typescript
import { z } from 'zod';

export const uploadChatAttachmentSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
});

export const taskImportRowSchema = z.object({
  'Task Name': z.string().min(1).max(200),
  Details: z.string().max(1000).optional(),
  Progress: z.coerce.number().min(0).max(100),
  Sprint: z.string().max(100).optional(),
  'Assigned To': z.string().email().optional(),
  'Start Date': z.string().optional(), // Will parse later
  Deadline: z.string().optional(),
  'Nesting Level': z.coerce.number().min(0).max(3),
  'Parent ID': z.string().uuid().optional(),
});

export type TaskImportRow = z.infer<typeof taskImportRowSchema>;
```

---

### Step 4: CSV/Excel Parser (45 min)

**File**: `server/src/upload/parser.ts`

```typescript
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { taskImportRowSchema, TaskImportRow } from './validators';

export async function parseCSV(filePath: string): Promise<TaskImportRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(filePath, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as TaskImportRow[];
        resolve(rows);
      },
      error: (error) => reject(error),
    });
  });
}

export function parseExcel(filePath: string): TaskImportRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  return data as TaskImportRow[];
}

export function validateTaskRows(rows: any[]): {
  valid: TaskImportRow[];
  errors: Array<{ row: number; error: string }>;
} {
  const valid: TaskImportRow[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, index) => {
    try {
      const validated = taskImportRowSchema.parse(row);
      valid.push(validated);
    } catch (error: any) {
      errors.push({
        row: index + 2, // +2 for header row and 1-indexed
        error: error.errors[0].message,
      });
    }
  });

  return { valid, errors };
}
```

---

### Step 5: Upload Service (60 min)

**File**: `server/src/upload/service.ts`

Implement all business logic:
- `uploadFile(file, userId)` - Store file metadata
- `uploadChatAttachment(file, userId, conversationId)` - Chat attachment
- `importTasks(file, userId)` - Parse and create tasks
- `getFileById(id, userId)` - Get file with auth check
- `listFiles(userId, filters, pagination)` - List files
- `deleteFile(id, userId)` - Delete file

---

### Step 6: Controllers & Routes (30 min)

**File**: `server/src/upload/controller.ts`

Implement request handlers for all endpoints.

**File**: `server/src/upload/routes.ts`

```typescript
import { Router } from 'express';
import { isAuthenticated, isAdmin } from '@/auth/middleware';
import { upload, uploadCSV } from './multer-config';
import * as uploadController from './controller';

const router = Router();

router.post('/', isAuthenticated, upload.single('file'), uploadController.uploadFile);
router.post('/tasks-import', isAuthenticated, isAdmin, uploadCSV.single('file'), uploadController.importTasks);
router.post('/chat-attachment', isAuthenticated, upload.single('file'), uploadController.uploadChatAttachment);
router.get('/download/:id', isAuthenticated, uploadController.downloadFile);
router.get('/files', isAuthenticated, uploadController.listFiles);
router.delete('/:id', isAuthenticated, uploadController.deleteFile);

export default router;
```

---

### Step 7: Update App Routes (5 min)

**File**: `server/src/app.ts`

```typescript
import uploadRoutes from './upload/routes';

app.use('/api/upload', uploadRoutes);
```

---

### Step 8: Create Uploads Directory (5 min)

```bash
mkdir -p server/uploads
echo "*" > server/uploads/.gitignore
echo "!.gitignore" >> server/uploads/.gitignore
```

---

## Security Considerations

### 1. File Type Validation

**Multi-layer Approach**:

```typescript
// 1. MIME type (Multer fileFilter)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'application/pdf', ...];

// 2. File extension
const ext = path.extname(file.originalname).toLowerCase();
const ALLOWED_EXTENSIONS = ['.jpg', '.pdf', '.csv', ...];

// 3. Magic bytes (optional, for high security)
function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const signatures = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
  };
  // Check first few bytes match expected signature
}
```

### 2. Filename Sanitization

```typescript
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
    .replace(/\.{2,}/g, '.') // Remove consecutive dots
    .slice(0, 255); // Limit length
}
```

### 3. Path Traversal Prevention

```typescript
// ❌ NEVER use original filename directly
const badPath = path.join('uploads', file.originalname); // Vulnerable!

// ✅ Always generate new filename
const safePath = path.join('uploads', `${uuid()}-${sanitize(file.originalname)}`);
```

### 4. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: 'Too many uploads, please try again later',
});

router.post('/upload', uploadLimiter, ...);
```

### 5. File Size Validation

```typescript
// Multer config
limits: {
  fileSize: 5 * 1024 * 1024, // 5MB
  files: 1, // Single file only
}

// Error handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 5MB)' });
    }
  }
});
```

### 6. Authorization

```typescript
// Check file ownership or conversation membership
async function canAccessFile(fileId: string, userId: string): Promise<boolean> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { conversation: { include: { members: true } } },
  });

  // Owner can access
  if (file.uploadedById === userId) return true;

  // Conversation member can access
  if (file.conversationId) {
    const isMember = file.conversation.members.some(m => m.userId === userId);
    return isMember;
  }

  return false;
}
```

### 7. Storage Isolation

```typescript
// Store outside web root
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Serve via dedicated endpoint (not static middleware)
router.get('/download/:id', async (req, res) => {
  const file = await getFileById(req.params.id);
  res.sendFile(file.path); // Controlled access
});

// ❌ NEVER do this:
// app.use('/uploads', express.static('uploads')); // Direct access vulnerability!
```

---

## Testing Strategy

### Unit Tests

**parser.test.ts**:
- Test CSV parsing with valid data
- Test Excel parsing
- Test malformed CSV handling
- Test validation errors

**service.test.ts**:
- Test file upload
- Test task import
- Test chat attachment
- Test file deletion

### Integration Tests

**File**: `tests/feature/file-upload.test.ts`

**Test Suites**:

1. **Generic File Upload**
   - Upload supported file types
   - Reject unsupported types
   - Enforce size limits
   - Sanitize filenames

2. **CSV/Excel Import**
   - Import valid CSV
   - Import valid Excel
   - Handle validation errors
   - Limit row count
   - Admin-only access

3. **Chat Attachments**
   - Upload with conversationId
   - Check conversation membership
   - Link to message

4. **File Download**
   - Download own file
   - Access conversation file (member)
   - Deny access (non-member)

5. **File Management**
   - List files
   - Filter by conversation
   - Delete own file
   - Admin delete any file

6. **Security Tests**
   - Path traversal attempts
   - MIME type spoofing
   - File size bypass
   - Rate limit enforcement

### CI/CD Tests

**File**: `tests/CI_CD/file-upload-ci.yml`

**Jobs**:
1. `test-file-upload` - Basic upload tests
2. `test-csv-import` - Task import tests
3. `test-file-security` - Security validation
4. `test-file-parser` - CSV/Excel parsing
5. `integration-test` - Full integration
6. `code-quality` - ESLint, Prettier
7. `performance-test` - Upload speed
8. `storage-test` - Disk space handling

---

## Performance Considerations

### 1. File Streaming

```typescript
// ✅ Stream files (don't load into memory)
router.get('/download/:id', (req, res) => {
  const fileStream = fs.createReadStream(file.path);
  fileStream.pipe(res);
});

// ❌ Don't read entire file into memory
const data = fs.readFileSync(file.path); // Bad for large files
res.send(data);
```

### 2. CSV Parsing Optimization

```typescript
// For large CSVs, use streaming
Papa.parse(fileStream, {
  header: true,
  step: (row) => {
    // Process row by row
    processRow(row.data);
  },
  complete: () => {
    console.log('Parsing complete');
  },
});
```

### 3. Database Batch Operations

```typescript
// Insert tasks in batches (avoid N+1 queries)
await prisma.task.createMany({
  data: validTasks,
  skipDuplicates: true,
});
```

### 4. Thumbnail Generation (Optional)

```typescript
// Generate thumbnails for images in background
import sharp from 'sharp';

async function generateThumbnail(imagePath: string) {
  const thumbnailPath = imagePath.replace(/(\.\w+)$/, '-thumb$1');
  await sharp(imagePath)
    .resize(200, 200, { fit: 'inside' })
    .toFile(thumbnailPath);
  return thumbnailPath;
}
```

### 5. Cleanup Old Files

```typescript
// Cron job to delete files older than 90 days (optional)
async function cleanupOldFiles() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const oldFiles = await prisma.file.findMany({
    where: {
      createdAt: { lt: ninetyDaysAgo },
      conversationId: null, // Don't delete chat attachments
    },
  });

  for (const file of oldFiles) {
    fs.unlinkSync(file.path);
    await prisma.file.delete({ where: { id: file.id } });
  }
}
```

---

## Deliverables Checklist

### Code Files
- [ ] `server/database/prisma/schema.prisma` (updated)
- [ ] `server/src/upload/multer-config.ts`
- [ ] `server/src/upload/storage.ts`
- [ ] `server/src/upload/parser.ts`
- [ ] `server/src/upload/validators.ts`
- [ ] `server/src/upload/service.ts`
- [ ] `server/src/upload/controller.ts`
- [ ] `server/src/upload/routes.ts`
- [ ] `server/src/app.ts` (updated)

### Tests
- [ ] `tests/feature/file-upload.test.ts`
- [ ] `tests/CI_CD/file-upload-ci.yml`

### Documentation
- [ ] `docs/plans/08-file-upload-plan.md` (this file)
- [ ] `docs/documentation/08-file-upload.md`

### Infrastructure
- [ ] Create `server/uploads/` directory
- [ ] Add `.gitignore` for uploads

### Status Updates
- [ ] Update `IMPLEMENTATION_STATUS.md`
- [ ] Update `README.md`

---

## Timeline

| Task | Estimated Time |
|------|---------------|
| Database Migration | 15 min |
| Multer Config | 30 min |
| Validators | 20 min |
| Parser | 45 min |
| Service | 60 min |
| Controllers | 30 min |
| Routes | 15 min |
| App Integration | 5 min |
| Tests | 45 min |
| CI/CD | 20 min |
| Documentation | 30 min |
| **Total** | **~4.5 hours** |

---

## Success Criteria

- [ ] All endpoints working with proper validation
- [ ] File uploads stored securely
- [ ] CSV/Excel import creates tasks correctly
- [ ] Chat attachments linked to conversations
- [ ] File download with authorization
- [ ] Rate limiting prevents abuse
- [ ] All tests passing (>90% coverage)
- [ ] CI/CD pipeline green
- [ ] Documentation complete
- [ ] No security vulnerabilities

---

## Notes

- Local storage for development (easy testing)
- Cloud storage (S3/GCS) for production (future enhancement)
- Virus scanning optional (can add later with ClamAV)
- Image thumbnails optional (can add with Sharp library)
- File retention policy configurable (default: keep forever)

---

**Ready to implement!** 🚀
