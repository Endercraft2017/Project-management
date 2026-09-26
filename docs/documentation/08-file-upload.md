# Feature 8: File Upload System - Documentation

**Version**: 1.0.0
**Status**: Completed
**Last Updated**: 2025-10-10

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [REST API Reference](#rest-api-reference)
5. [CSV/Excel Task Import](#csvexcel-task-import)
6. [Chat Attachments](#chat-attachments)
7. [Security](#security)
8. [Client Integration Guide](#client-integration-guide)
9. [Error Handling](#error-handling)
10. [Performance](#performance)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## Overview

### Purpose

The File Upload System provides secure file upload capabilities for ServiceBay PM, including generic file uploads, bulk task import from CSV/Excel files, and chat message attachments.

### Key Features

✅ **Generic File Upload**: Upload documents, images, PDFs (max 5MB)
✅ **CSV/Excel Task Import**: Bulk import tasks from spreadsheets (max 10MB)
✅ **Chat Attachments**: Attach files to conversations
✅ **File Management**: List, download, delete files with authorization
✅ **Security**: MIME type validation, file size limits, filename sanitization
✅ **Rate Limiting**: 10 uploads per 15 minutes
✅ **Authorization**: Owner/member/admin access control
✅ **Audit Logging**: Track all file operations

### Technology Stack

- **Multer**: File upload middleware for Express
- **PapaParse**: CSV parsing
- **XLSX (SheetJS)**: Excel parsing
- **Zod**: Input validation
- **Prisma**: Database ORM
- **PostgreSQL**: File metadata storage
- **Local Disk Storage**: File storage (development/production)

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Application                     │
│  ┌──────────────────┐          ┌──────────────────┐        │
│  │   File Select    │          │   Progress Bar   │        │
│  │   (input type=   │          │   (upload status)│        │
│  │   "file")        │          │                  │        │
│  └────────┬─────────┘          └────────┬─────────┘        │
└───────────┼───────────────────────────────┼──────────────────┘
            │                               │
            │ multipart/form-data           │ Progress events
            │                               │
┌───────────┼───────────────────────────────┼──────────────────┐
│           │                               │                  │
│  ┌────────▼─────────┐          ┌─────────▼────────┐        │
│  │  Multer          │          │  Rate Limiter    │        │
│  │  Middleware      │          │  (10/15min)      │        │
│  └────────┬─────────┘          └──────────────────┘        │
│           │                                                  │
│  ┌────────▼─────────┐                                       │
│  │  File Filter     │                                       │
│  │  - MIME type     │                                       │
│  │  - Extension     │                                       │
│  │  - Size limit    │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│  ┌────────▼─────────┐                                       │
│  │  Disk Storage    │                                       │
│  │  (uploads/)      │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│  ┌────────▼──────────────────────────────────────┐         │
│  │            Upload Service                      │         │
│  │  - Store metadata in database                 │         │
│  │  - Parse CSV/Excel (if task import)           │         │
│  │  - Link to conversation (if chat attachment)  │         │
│  └────────────────────┬───────────────────────────┘         │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────┐         │
│  │          Prisma Client (ORM)                    │         │
│  └────────────────────┬───────────────────────────┘         │
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                   PostgreSQL Database                         │
│  - File metadata (id, filename, path, size, mime)           │
│  - Task imports (via parser)                                 │
└───────────────────────────────────────────────────────────────┘
```

### File Structure

```
server/src/upload/
├── multer-config.ts       # Multer setup, file filter, storage
├── parser.ts              # CSV/Excel parsing logic
├── validators.ts          # Zod validation schemas
├── service.ts             # Business logic
├── controller.ts          # Request handlers
└── routes.ts              # Route definitions

server/uploads/            # File storage directory
└── .gitignore             # Ignore uploaded files in git
```

---

## Database Schema

### File Model

```prisma
model File {
  id              String    @id @default(uuid())
  filename        String    // Original filename (sanitized)
  storedFilename  String    // Generated unique filename
  mimeType        String
  size            Int       // Bytes
  path            String    // Storage path
  uploadedById    String
  conversationId  String?   // For chat attachments
  messageId       String?   // For chat attachments
  createdAt       DateTime  @default(now())

  uploadedBy      User          @relation(...)
  conversation    Conversation? @relation(...)
  message         Message?      @relation(...)
}
```

**Fields**:
- `filename`: Sanitized original filename
- `storedFilename`: UUID-based unique filename on disk
- `mimeType`: MIME type from upload
- `size`: File size in bytes
- `path`: Absolute path to file on disk
- `uploadedById`: User who uploaded the file
- `conversationId`: Linked conversation (for chat attachments)
- `messageId`: Linked message (for chat attachments)

**Relations**:
- `uploadedBy`: Many-to-one with User
- `conversation`: Many-to-one with Conversation (optional)
- `message`: Many-to-one with Message (optional)

---

## REST API Reference

### Base URL

```
/api/upload
```

### Authentication

All endpoints require authentication. Include session cookie in requests.

---

### 1. Upload Generic File

Upload any supported file type.

**Endpoint**: `POST /api/upload`

**Request**: `multipart/form-data`

```
Content-Type: multipart/form-data

file: <binary data>
```

**Supported File Types**:
- Images: jpg, jpeg, png, gif, webp
- Documents: pdf, doc, docx
- Spreadsheets: xls, xlsx, csv
- Text: txt

**Max Size**: 5MB

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "filename": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1024576,
    "url": "/api/upload/download/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "uploadedBy": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@servicebay.ai"
    },
    "createdAt": "2025-10-10T10:30:00Z"
  }
}
```

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | No file or unsupported type |
| 401 | Unauthorized | Not authenticated |
| 413 | Payload Too Large | File exceeds 5MB |
| 429 | Too Many Requests | Rate limit exceeded (10/15min) |

**Example Usage**:

```javascript
// Using FormData
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  credentials: 'include',
  body: formData
});

const data = await response.json();
console.log('Uploaded:', data.data.url);
```

```javascript
// Using axios
const formData = new FormData();
formData.append('file', file);

const response = await axios.post('/api/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  withCredentials: true,
  onUploadProgress: (progressEvent) => {
    const percentCompleted = Math.round(
      (progressEvent.loaded * 100) / progressEvent.total
    );
    console.log(`Upload progress: ${percentCompleted}%`);
  }
});
```

---

### 2. Import Tasks from CSV/Excel

Bulk import tasks from a spreadsheet file (Admin only).

**Endpoint**: `POST /api/upload/tasks-import`

**Request**: `multipart/form-data`

```
Content-Type: multipart/form-data

file: <CSV or Excel file>
```

**Supported Formats**: .csv, .xls, .xlsx

**Max Size**: 10MB

**Max Rows**: 10,000

**Expected CSV Format**:

```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
"Task 1","Description here",50,"Sprint 1","john@servicebay.ai","2025-01-01","2025-01-31",0,
"Subtask 1.1","Subtask details",25,"Sprint 1","jane@servicebay.ai","2025-01-02","2025-01-15",1,"parent-task-uuid"
"Task 2","Another task",75,"Sprint 2","","2025-02-01","2025-02-28",0,
```

**Required Columns**:
- Task Name (1-200 characters)
- Progress (0-100)
- Nesting Level (0-3)

**Optional Columns**:
- Details (max 1,000 characters)
- Sprint (must exist in database)
- Assigned To (must be valid user email)
- Start Date (ISO 8601 or MM/DD/YYYY)
- Deadline (ISO 8601 or MM/DD/YYYY)
- Parent ID (must be valid task UUID for nested tasks)

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
        "error": "Assigned To: User 'invalid@example.com' not found or inactive"
      },
      {
        "row": 7,
        "error": "Progress: Progress must be 0-100"
      }
    ],
    "tasks": [
      {
        "id": "task-uuid-1",
        "name": "Task 1",
        "progress": 50,
        "nestingLevel": 0
      },
      {
        "id": "task-uuid-2",
        "name": "Subtask 1.1",
        "progress": 25,
        "nestingLevel": 1
      }
    ]
  }
}
```

**Business Rules**:
- Only admins can import tasks
- File cleaned up after parsing (temporary)
- Sprint must exist before assignment
- Assigned user must exist and be active
- Parent task must exist for nested tasks
- Dates parsed as ISO 8601 or MM/DD/YYYY
- Errors returned for first 50 failures

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation Error | Missing columns, invalid data, empty file |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not an admin |
| 413 | Payload Too Large | File exceeds 10MB |
| 429 | Too Many Requests | Rate limit exceeded |

**Example Usage**:

```javascript
const formData = new FormData();
formData.append('file', csvFile);

const response = await fetch('/api/upload/tasks-import', {
  method: 'POST',
  credentials: 'include',
  body: formData
});

const result = await response.json();
console.log(`Imported: ${result.data.imported}, Skipped: ${result.data.skipped}`);

if (result.data.errors.length > 0) {
  console.log('Errors:', result.data.errors);
}
```

---

### 3. Upload Chat Attachment

Upload a file as an attachment to a conversation.

**Endpoint**: `POST /api/upload/chat-attachment`

**Request**: `multipart/form-data`

```
Content-Type: multipart/form-data

file: <binary data>
conversationId: <uuid>
```

**Max Size**: 5MB

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "file-uuid",
    "filename": "screenshot.png",
    "mimeType": "image/png",
    "size": 245760,
    "url": "/api/upload/download/file-uuid",
    "conversationId": "conversation-uuid",
    "uploadedBy": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@servicebay.ai"
    },
    "createdAt": "2025-10-10T10:30:00Z"
  }
}
```

**Business Rules**:
- User must be a member of the conversation
- File linked to conversation (messageId set when message is created)
- All conversation members can access the file

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | No file or missing conversationId |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not a member of conversation |
| 404 | Not Found | Conversation not found |
| 413 | Payload Too Large | File exceeds 5MB |

**Example Usage**:

```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('conversationId', conversationId);

const response = await fetch('/api/upload/chat-attachment', {
  method: 'POST',
  credentials: 'include',
  body: formData
});

const data = await response.json();
console.log('Attachment uploaded:', data.data.id);
```

---

### 4. Download File

Download a previously uploaded file.

**Endpoint**: `GET /api/upload/download/:id`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | File UUID |

**Response**: `200 OK`

```
Content-Type: <file MIME type>
Content-Disposition: attachment; filename="<filename>"
Content-Length: <file size>

<binary data>
```

**Authorization Rules**:
- File owner can download
- Conversation members can download chat attachments
- Admins can download any file

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not authorized to access file |
| 404 | Not Found | File not found |
| 500 | Internal Server Error | File read error |

**Example Usage**:

```javascript
// Direct download link
<a href="/api/upload/download/file-uuid" download>
  Download File
</a>

// Fetch and display
const response = await fetch(`/api/upload/download/${fileId}`, {
  credentials: 'include'
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);

// Display image
const img = document.createElement('img');
img.src = url;

// Or trigger download
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
```

---

### 5. List Files

Get a list of uploaded files.

**Endpoint**: `GET /api/upload/files`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `conversationId` | string | No | - | Filter by conversation |
| `page` | number | No | 1 | Page number (1-indexed) |
| `limit` | number | No | 20 | Results per page (max 100) |

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "file-uuid",
        "filename": "document.pdf",
        "mimeType": "application/pdf",
        "size": 1024576,
        "url": "/api/upload/download/file-uuid",
        "uploadedBy": {
          "id": "user-uuid",
          "name": "John Doe",
          "email": "john@servicebay.ai"
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

**Business Rules**:
- Returns user's own files
- Returns files from conversations user is a member of
- Sorted by createdAt DESC (newest first)

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation Error | Invalid query parameters |
| 401 | Unauthorized | Not authenticated |
| 500 | Internal Server Error | Database error |

**Example Usage**:

```javascript
// List all files
const response = await fetch('/api/upload/files', {
  credentials: 'include'
});
const data = await response.json();

// Filter by conversation
const files = await fetch(`/api/upload/files?conversationId=${convId}`, {
  credentials: 'include'
});

// Pagination
const page2 = await fetch('/api/upload/files?page=2&limit=10', {
  credentials: 'include'
});
```

---

### 6. Delete File

Delete a file (owner or admin only).

**Endpoint**: `DELETE /api/upload/:id`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | File UUID |

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Business Rules**:
- File owner can delete their own files
- Admins can delete any file
- File deleted from disk AND database
- Cascade deletes if linked to message

**Errors**:

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not owner or admin |
| 404 | Not Found | File not found |
| 500 | Internal Server Error | Deletion failed |

**Example Usage**:

```javascript
const response = await fetch(`/api/upload/${fileId}`, {
  method: 'DELETE',
  credentials: 'include'
});

if (response.ok) {
  console.log('File deleted');
}
```

---

## CSV/Excel Task Import

### CSV Format Specification

**Header Row** (required):
```
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
```

**Data Types**:
- `Task Name`: Text (1-200 chars) - **Required**
- `Details`: Text (0-1000 chars) - Optional
- `Progress`: Integer (0-100) - **Required**
- `Sprint`: Text (sprint name) - Optional
- `Assigned To`: Email address - Optional
- `Start Date`: Date (ISO 8601 or MM/DD/YYYY) - Optional
- `Deadline`: Date (ISO 8601 or MM/DD/YYYY) - Optional
- `Nesting Level`: Integer (0-3) - **Required**
- `Parent ID`: UUID - Optional (required if Nesting Level > 0)

### Excel Format

Same columns as CSV. Use first sheet only.

### Examples

**Valid CSV**:
```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
"Setup Development Environment","Install Node.js, PostgreSQL, VS Code",100,"Sprint 1","dev@servicebay.ai","2025-01-01","2025-01-05",0,
"Database Schema","Design and implement schema",75,"Sprint 1","dev@servicebay.ai","2025-01-06","2025-01-10",0,
"User Model","Create User model",100,"Sprint 1","dev@servicebay.ai","2025-01-11","2025-01-12",1,"uuid-of-database-schema-task"
"Task Model","Create Task model",50,"Sprint 1","","2025-01-13","2025-01-15",1,"uuid-of-database-schema-task"
```

**Validation Rules**:
1. Task Name required and non-empty
2. Progress between 0-100
3. Nesting Level between 0-3
4. Sprint must exist in database (if provided)
5. Assigned To must be a valid, active user email (if provided)
6. Parent ID must be a valid task UUID (if Nesting Level > 0)
7. Dates must be parseable (ISO 8601 or MM/DD/YYYY)

### Error Handling

Errors reported per row:

```json
{
  "imported": 45,
  "skipped": 5,
  "errors": [
    {
      "row": 3,
      "error": "Sprint 'Nonexistent Sprint' not found"
    },
    {
      "row": 7,
      "error": "Progress: Progress must be 0-100"
    },
    {
      "row": 12,
      "error": "Assigned To: User 'invalid@email.com' not found or inactive"
    }
  ]
}
```

---

## Chat Attachments

### Upload Flow

1. User selects file in chat UI
2. Frontend uploads to `/api/upload/chat-attachment` with `conversationId`
3. Backend validates user membership
4. File stored and metadata saved with `conversationId`
5. When user sends message, `messageId` is set on file
6. Frontend displays attachment in message

### Integration with Chat

```javascript
// 1. Upload file
const formData = new FormData();
formData.append('file', file);
formData.append('conversationId', conversationId);

const uploadRes = await fetch('/api/upload/chat-attachment', {
  method: 'POST',
  credentials: 'include',
  body: formData
});

const fileData = await uploadRes.json();
const fileId = fileData.data.id;

// 2. Send message with attachment reference
socket.emit('send_message', {
  conversationId,
  content: 'Check out this file',
  attachmentId: fileId  // Link file to message
});

// 3. Display in chat
<div class="message">
  <p>{message.content}</p>
  {message.attachmentId && (
    <a href={`/api/upload/download/${message.attachmentId}`} download>
      📎 {message.attachmentFilename}
    </a>
  )}
</div>
```

### File Preview

For images, show thumbnails:

```javascript
function renderAttachment(file) {
  if (file.mimeType.startsWith('image/')) {
    return (
      <img
        src={`/api/upload/download/${file.id}`}
        alt={file.filename}
        style={{ maxWidth: '300px' }}
      />
    );
  } else if (file.mimeType === 'application/pdf') {
    return (
      <a href={`/api/upload/download/${file.id}`} target="_blank">
        📄 {file.filename}
      </a>
    );
  } else {
    return (
      <a href={`/api/upload/download/${file.id}`} download>
        📎 {file.filename}
      </a>
    );
  }
}
```

---

## Security

### Implemented Security Measures

**1. File Type Validation**

Multi-layer approach:

```typescript
// Layer 1: MIME type whitelist
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  // ...
];

// Layer 2: File extension validation
const ALLOWED_EXTENSIONS = ['.jpg', '.png', '.pdf', ...];

// Layer 3: Magic bytes check (optional)
// Check first few bytes match expected file signature
```

**2. File Size Limits**

```typescript
limits: {
  fileSize: 5 * 1024 * 1024,  // 5MB for general uploads
  files: 1,  // Single file only
}

// CSV/Excel: 10MB limit
```

**3. Filename Sanitization**

```typescript
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Remove special chars
    .replace(/\.{2,}/g, '.') // Remove consecutive dots
    .replace(/^\./, '') // Remove leading dot
    .slice(0, 255); // Limit length
}
```

**4. Path Traversal Prevention**

```typescript
// ❌ NEVER use original filename
const badPath = path.join('uploads', file.originalname); // VULNERABLE!

// ✅ Always generate new filename
const safePath = path.join('uploads', `${Date.now()}-${sanitized}.ext`);
```

**5. Rate Limiting**

```typescript
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
});
```

**6. Authorization Checks**

```typescript
// File download authorization
async function canAccessFile(fileId: string, userId: string) {
  const file = await prisma.file.findUnique({ ... });

  // Owner can access
  if (file.uploadedById === userId) return true;

  // Conversation member can access
  if (file.conversationId) {
    const isMember = await isConversationMember(file.conversationId, userId);
    return isMember;
  }

  // Admin can access
  const user = await getUser(userId);
  return user.role === 'ADMIN';
}
```

**7. Storage Isolation**

```typescript
// Store outside web root
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Serve via controlled endpoint (NOT static middleware)
router.get('/download/:id', authenticate, async (req, res) => {
  const file = await getFile(req.params.id, req.user.id);
  res.sendFile(file.path); // Authorized access only
});

// ❌ NEVER do this:
// app.use('/uploads', express.static('uploads')); // Direct access!
```

### Best Practices for Clients

**1. Validate Before Upload**

```javascript
function validateFile(file) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  if (file.size > maxSize) {
    throw new Error('File too large (max 5MB)');
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Unsupported file type');
  }

  return true;
}
```

**2. Show Upload Progress**

```javascript
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable) {
    const percentComplete = (e.loaded / e.total) * 100;
    updateProgressBar(percentComplete);
  }
});
```

**3. Handle Errors Gracefully**

```javascript
try {
  const response = await uploadFile(file);
  showSuccess('File uploaded successfully');
} catch (error) {
  if (error.status === 413) {
    showError('File too large. Please upload a smaller file.');
  } else if (error.status === 400) {
    showError('Unsupported file type.');
  } else {
    showError('Upload failed. Please try again.');
  }
}
```

---

## Client Integration Guide

### React Example

```typescript
// components/FileUpload.tsx
import { useState } from 'react';

export function FileUpload({ onUploadComplete }: { onUploadComplete: (file: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large (max 5MB)');
      return;
    }

    // Upload
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          setProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          onUploadComplete(response.data);
          setUploading(false);
        } else {
          const error = JSON.parse(xhr.responseText);
          setError(error.message);
          setUploading(false);
        }
      });

      xhr.open('POST', '/api/upload');
      xhr.withCredentials = true;
      xhr.send(formData);
    } catch (err: any) {
      setError(err.message);
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {uploading && (
        <div>
          <progress value={progress} max="100" />
          <span>{Math.round(progress)}%</span>
        </div>
      )}

      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
```

### CSV Import Example

```typescript
// components/TaskImport.tsx
import { useState } from 'react';

export function TaskImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload/tasks-import', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      setResult(data.data);
    } catch (error: any) {
      alert('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h2>Import Tasks from CSV/Excel</h2>
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleImport}
        disabled={importing}
      />

      {importing && <p>Importing...</p>}

      {result && (
        <div>
          <h3>Import Results</h3>
          <p>Imported: {result.imported}</p>
          <p>Skipped: {result.skipped}</p>

          {result.errors.length > 0 && (
            <div>
              <h4>Errors:</h4>
              <ul>
                {result.errors.map((err: any, i: number) => (
                  <li key={i}>
                    Row {err.row}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling

### Common Errors

**File Too Large (413)**:
```javascript
if (response.status === 413) {
  alert('File exceeds size limit (5MB for uploads, 10MB for CSV)');
}
```

**Unsupported File Type (400)**:
```javascript
if (response.body.message.includes('Unsupported')) {
  alert('This file type is not supported. Please use: jpg, png, pdf, csv, xlsx');
}
```

**Rate Limit Exceeded (429)**:
```javascript
if (response.status === 429) {
  alert('Too many uploads. Please wait a few minutes and try again.');
}
```

**Not Authorized (403)**:
```javascript
if (response.status === 403) {
  alert('You do not have permission to access this resource.');
}
```

### Error Recovery

```javascript
async function uploadWithRetry(file, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadFile(file);
    } catch (error) {
      if (error.status === 429) {
        // Wait and retry on rate limit
        await new Promise(resolve => setTimeout(resolve, 60000));
        continue;
      }
      throw error; // Don't retry other errors
    }
  }
  throw new Error('Upload failed after ' + maxRetries + ' attempts');
}
```

---

## Performance

### Optimization Techniques

**1. File Streaming**

```typescript
// ✅ Stream files (don't load into memory)
router.get('/download/:id', (req, res) => {
  const fileStream = fs.createReadStream(file.path);
  fileStream.pipe(res);
});
```

**2. CSV Parsing**

```typescript
// For large CSVs, use streaming
Papa.parse(fileStream, {
  header: true,
  step: (row) => {
    processRow(row.data); // Process one row at a time
  },
  complete: () => {
    console.log('Parsing complete');
  }
});
```

**3. Batch Database Operations**

```typescript
// ✅ Insert tasks in batch
await prisma.task.createMany({
  data: validTasks,
  skipDuplicates: true
});

// ❌ Don't insert one by one
for (const task of tasks) {
  await prisma.task.create({ data: task }); // Slow!
}
```

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Upload time (5MB) | < 2s | Over broadband connection |
| CSV parsing (10K rows) | < 5s | Includes validation |
| File download | < 1s | For files up to 5MB |
| Task import | < 10s | For 1,000 tasks |

---

## Testing

### Running Tests

```bash
cd server

# Run all file upload tests
npm test -- tests/feature/file-upload.test.ts

# Run specific test suite
npm test -- tests/feature/file-upload.test.ts --testNamePattern="Generic File Upload"

# With coverage
npm test -- tests/feature/file-upload.test.ts --coverage
```

### Test Coverage

**Covered**:
- ✅ Generic file upload
- ✅ CSV/Excel task import
- ✅ Chat attachments
- ✅ File download authorization
- ✅ File deletion
- ✅ Rate limiting
- ✅ Security validations
- ✅ Error handling

**Test Data**:
- Sample CSV with valid data
- Sample CSV with validation errors
- Sample images (JPEG, PNG)
- Large files (>5MB) for size limit testing

---

## Troubleshooting

### Common Issues

**Issue: "No file uploaded" error**

**Cause**: FormData not sent correctly

**Solution**:
```javascript
// ✅ Correct
const formData = new FormData();
formData.append('file', fileInput.files[0]);

// ❌ Incorrect
const formData = { file: fileInput.files[0] }; // Won't work!
```

**Issue: "File too large" error**

**Cause**: File exceeds size limit

**Solution**: Validate file size before upload
```javascript
if (file.size > 5 * 1024 * 1024) {
  alert('File too large. Maximum size is 5MB.');
  return;
}
```

**Issue: CSV import fails with "Missing required columns"**

**Cause**: CSV headers don't match expected format

**Solution**: Ensure CSV has exact header names:
```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
```

**Issue: Downloads fail with 403 error**

**Cause**: User not authorized to access file

**Solution**: Check authorization:
- User must be file owner, OR
- User must be member of conversation (for chat attachments), OR
- User must be admin

**Issue: Uploads directory not found**

**Cause**: Directory not created

**Solution**:
```bash
cd server
mkdir -p uploads
```

---

## Best Practices

### Development

**1. Test with Real Files**

```bash
# Create test files
cd tests/test-files
echo "Test content" > test.txt
curl -o test-image.jpg "https://via.placeholder.com/150"
```

**2. Monitor Upload Directory**

```bash
# Check disk usage
du -sh server/uploads

# List recent uploads
ls -lht server/uploads | head -10
```

**3. Clean Up Old Files** (Optional)

```typescript
// Cron job to delete files older than 90 days
async function cleanupOldFiles() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const oldFiles = await prisma.file.findMany({
    where: {
      createdAt: { lt: ninetyDaysAgo },
      conversationId: null // Don't delete chat attachments
    }
  });

  for (const file of oldFiles) {
    fs.unlinkSync(file.path);
    await prisma.file.delete({ where: { id: file.id } });
  }
}
```

### Production

**1. Use Cloud Storage**

For production, migrate to AWS S3 or Google Cloud Storage:

```typescript
// AWS S3 example
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

async function uploadToS3(file: Express.Multer.File) {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: file.filename,
    Body: fs.createReadStream(file.path),
    ContentType: file.mimetype
  };

  const result = await s3.upload(params).promise();
  return result.Location; // S3 URL
}
```

**2. Implement Virus Scanning** (Optional)

Use ClamAV or similar:

```typescript
import clamav from 'clamav.js';

async function scanFile(filePath: string) {
  const result = await clamav.scanFile(filePath);
  if (result.isInfected) {
    fs.unlinkSync(filePath);
    throw new Error('File contains malware');
  }
}
```

**3. Set Up CDN** (for downloads)

Use Cloudflare or AWS CloudFront to cache downloaded files.

---

## Appendix

### Environment Variables

```bash
# Optional (for cloud storage)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=your-bucket-name
```

### Dependencies

```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1",
    "papaparse": "^5.4.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/multer": "^1.4.11",
    "@types/papaparse": "^5.3.14"
  }
}
```

### Useful Links

- [Multer Documentation](https://github.com/expressjs/multer)
- [PapaParse Documentation](https://www.papaparse.com/docs)
- [XLSX (SheetJS) Documentation](https://docs.sheetjs.com/)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

---

**Feature 8: File Upload System - Documentation Complete** ✅
