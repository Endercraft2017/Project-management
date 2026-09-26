# Phase 5: Google Drive File Sharing Implementation Plan

**Status**: ✅ Instance #1 Complete (OAuth & Drive Service)
**Created**: October 12, 2025
**Last Updated**: October 13, 2025

## Executive Summary

Implement file sharing in chat using Google Drive integration, where users can either pick existing files from their Drive or upload local files directly to their Drive, then share with conversation members. All files remain in users' Google Drive storage, avoiding Railway's ephemeral filesystem limitations.

## Why Google Drive Integration?

### Problems with Direct File Upload
- ❌ Railway has ephemeral filesystem (files deleted on restart)
- ❌ Railway volumes not shared across instances
- ❌ Storage costs for large files
- ❌ Bandwidth costs for file transfers

### Benefits of Google Drive Approach
- ✅ Zero storage costs on Railway
- ✅ Files persist indefinitely in user's Drive
- ✅ Leverages existing Google OAuth (@servicebay.ai requirement)
- ✅ Users control their own storage quota
- ✅ Natural integration with Google Workspace
- ✅ Built-in file sharing and permissions
- ✅ Free preview/thumbnail generation
- ✅ Familiar UI for users

## Research: How Other Services Do It

### Slack (2025 Model)
**Architecture**: Two-step async upload
- Old: `files.upload` (deprecated Nov 2025)
- New: `files.getUploadURLExternal` → `files.completeUploadExternal`
- **Rationale**: Better handling of large files, more reliable async processing

**File Behavior**:
- Without `channel_id`: File uploaded but private (only uploader access)
- With `channel_id`: File shared to channel (visible to all members)
- Default: All files private until shared to public channel

### Discord
**Architecture**: Three-step process
1. POST file metadata → Receive upload URL
2. PUT file to upload URL
3. File accessible via Discord CDN

**Features**:
- Max 10MB (non-Nitro), higher for Nitro users
- Alt text support for accessibility
- NSFW content scanning
- Files stored on Discord's CDN

### Microsoft Teams
**Architecture**: Built on SharePoint foundation
- Teams channels → SharePoint sites
- OneDrive → Single-user SharePoint library

**Integration**:
- Files shared in chat → Auto-added to user's OneDrive
- Team channel files → Stored in SharePoint site
- Single storage system for all files
- Direct OneDrive access from Teams, sync capability

### Our Approach
Hybrid model combining best practices:
1. User uploads to their own Drive (like OneDrive integration)
2. Automatic sharing with conversation members (like Slack channels)
3. Preview generation (like all three services)
4. Permission management (Drive API handles this)

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐        ┌─────────────────────────┐   │
│  │  Message Input   │───────▶│  Google Picker API      │   │
│  │  + Attach Button │        │  (DocsUploadView)       │   │
│  └──────────────────┘        └─────────────────────────┘   │
│                                         │                    │
│                                         ▼                    │
│                              User selects/uploads file       │
│                                         │                    │
│                                         ▼                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  File Preview Component                              │   │
│  │  - Image: <img> with thumbnailLink                  │   │
│  │  - PDF/Docs: <iframe> with /preview URL             │   │
│  │  - Markdown: react-markdown with fetched content    │   │
│  │  - Others: Card with thumbnail + download button    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 │ REST API / Socket.IO
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Server (Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Google Drive Service                                 │  │
│  │  - Upload file to user's Drive                       │  │
│  │  - Create folder "ServiceBay Chat Files"            │  │
│  │  - Share with conversation members                   │  │
│  │  - Fetch file metadata (thumbnail, preview URLs)    │  │
│  │  - Download .md files for rendering                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OAuth2 Token Manager                                 │  │
│  │  - Store refresh tokens in database                  │  │
│  │  - Auto-refresh access tokens when expired          │  │
│  │  - Handle token refresh for Drive API calls         │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Message Service (Extended)                           │  │
│  │  - Store Drive file metadata in message              │  │
│  │  - Broadcast file attachments via Socket.IO         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 │ Drive API
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Google Drive API                        │
├─────────────────────────────────────────────────────────────┤
│  - files.create (upload)                                     │
│  - files.get (metadata, thumbnailLink)                       │
│  - permissions.create (share with users)                     │
│  - files.export (download .md content)                       │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

```prisma
// User model extension
model User {
  // ... existing fields

  // Google Drive integration (Phase 5.1)
  googleRefreshToken String?   @db.Text
  googleAccessToken  String?   @db.Text
  tokenExpiresAt     DateTime?
}

// New model for message attachments (Phase 5.4)
model MessageAttachment {
  id             String   @id @default(uuid())
  messageId      String
  message        Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  // Google Drive file metadata
  driveFileId    String   // Google Drive file ID
  fileName       String
  mimeType       String
  fileSize       BigInt
  thumbnailLink  String?  @db.Text
  webViewLink    String   @db.Text // Open in Drive
  webContentLink String?  @db.Text // Direct download
  iconLink       String?

  createdAt      DateTime @default(now())

  @@index([messageId])
}

model Message {
  // ... existing fields
  attachments MessageAttachment[]
}
```

## Implementation Phases

### ✅ Phase 5.1: Google OAuth & Drive API Setup (COMPLETE)

**Status**: ✅ Implemented by Instance #1
**Branch**: main
**Commit**: 7797805

**Completed Tasks**:
1. ✅ Installed googleapis & google-auth-library
2. ✅ Updated User model with token fields
3. ✅ Created and applied database migration
4. ✅ Updated Passport Google Strategy with Drive scopes
5. ✅ Configured OAuth for refresh tokens (accessType: offline, prompt: consent)
6. ✅ Store tokens on every login/update
7. ✅ Created OAuth2 Client Manager ([server/src/services/google-oauth-client.ts](../../server/src/services/google-oauth-client.ts))
8. ✅ Implemented GET /api/auth/google/token endpoint
9. ✅ Created test script ([server/src/auth/test-drive-auth.ts](../../server/src/auth/test-drive-auth.ts))

**Key Files**:
- `server/prisma/schema.prisma` - Added Google token fields
- `server/src/auth/passport-config.ts` - Drive scopes, token storage
- `server/src/auth/routes.ts` - Token endpoint
- `server/src/services/google-oauth-client.ts` - OAuth management
- `server/src/auth/test-drive-auth.ts` - OAuth tests

### ✅ Phase 5.2: Google Drive Service Layer (COMPLETE)

**Status**: ✅ Implemented by Instance #1
**Branch**: main
**Commit**: 7797805

**Completed Tasks**:
1. ✅ Created TypeScript interfaces ([server/src/types/drive.ts](../../server/src/types/drive.ts))
2. ✅ Created Drive Service ([server/src/services/drive-service.ts](../../server/src/services/drive-service.ts)) with:
   - `uploadFile()` - Upload files to user's Drive
   - `getOrCreateChatFolder()` - Manage "ServiceBay Chat Files" folder
   - `shareFileWithUser/Users()` - Share with conversation members
   - `getFileMetadata()` - Get thumbnails, preview links, etc.
   - `downloadFileContent()` - Download markdown/text files
   - `checkFileAccess()` - Verify permissions
3. ✅ Implemented resumable upload support (>5MB)
4. ✅ Created comprehensive test script ([server/src/services/test-drive-upload.ts](../../server/src/services/test-drive-upload.ts))

**Key Files**:
- `server/src/types/drive.ts` - TypeScript interfaces
- `server/src/services/drive-service.ts` - Main Drive operations
- `server/src/services/test-drive-upload.ts` - Drive operation tests

### 🔄 Phase 5.3: Google Picker Integration (Frontend)

**Status**: 🔄 In Progress (Instance #3)
**Priority**: HIGH

**Tasks**:
1. Add Google Picker API scripts to index.html
2. Create TypeScript types for Picker
3. Create useGooglePicker hook
4. Add attach button to MessageInput
5. Implement file selection UI
6. Update send message logic to include driveFileIds
7. Add attach button to ThreadSidebar

**Expected Files**:
- `client/index.html` - Picker API scripts
- `client/src/types/google-picker.d.ts` - Picker types
- `client/src/hooks/useGooglePicker.ts` - Picker hook
- `client/src/components/chat/MessageInput.tsx` - Updated with attach button

### ⏳ Phase 5.4: File Upload Endpoint & Message Attachments

**Status**: ⏳ Pending (Instance #2)
**Priority**: CRITICAL

**Tasks**:
1. Create MessageAttachment model (database)
2. Update validation schemas
3. Update Message Service to accept attachments
4. Update Chat Controller with file attachment logic
5. Update Thread Reply endpoint
6. Create markdown content endpoint (GET /api/drive/files/:fileId/content)
7. Update Socket.IO types

**Expected Files**:
- `server/prisma/schema.prisma` - MessageAttachment model
- `server/src/chat/validators.ts` - Updated schemas
- `server/src/chat/message-service.ts` - Attachment handling
- `server/src/chat/controller.ts` - File attachment endpoints

### ⏳ Phase 5.5: File Preview UI Components

**Status**: ⏳ Pending (Instance #4)
**Priority**: HIGH

**Tasks**:
1. Install react-markdown, remark-gfm, rehype-highlight
2. Create utility functions (formatFileSize, etc.)
3. Create ImagePreview component
4. Create PdfPreview component
5. Create MarkdownPreview component
6. Create GoogleDocsPreview component
7. Create GenericFileCard component
8. Create main FileAttachment component
9. Create ImageModal component
10. Update MessageItem to render attachments
11. Update ThreadSidebar to render attachments

**Expected Files**:
- `client/src/utils/fileUtils.ts` - Utility functions
- `client/src/components/chat/attachments/ImagePreview.tsx`
- `client/src/components/chat/attachments/PdfPreview.tsx`
- `client/src/components/chat/attachments/MarkdownPreview.tsx`
- `client/src/components/chat/attachments/GoogleDocsPreview.tsx`
- `client/src/components/chat/attachments/GenericFileCard.tsx`
- `client/src/components/chat/attachments/FileAttachment.tsx`
- `client/src/components/chat/attachments/ImageModal.tsx`

### ⏳ Phase 5.6: Thread & Real-time Support

**Status**: ⏳ Pending (Instance #4)
**Priority**: HIGH

**Tasks**:
1. Verify Socket.IO event handling includes attachments
2. Update thread Socket.IO handlers
3. Test real-time updates with attachments

### ⏳ Phase 5.7: Error Handling & Edge Cases

**Status**: ⏳ Pending
**Priority**: HIGH

**Tasks**:
1. Handle Drive access revoked
2. Handle file too large (>100MB)
3. Handle Drive API rate limits
4. Handle permission denied errors
5. Handle file deleted from Drive
6. Implement proper error UI

### ⏳ Phase 5.8: Performance Optimization

**Status**: ⏳ Pending
**Priority**: MEDIUM

**Tasks**:
1. Implement caching for file metadata
2. Parallel processing for bulk operations
3. Lazy loading for file previews
4. Image optimization
5. Code splitting for file components

### ⏳ Phase 5.9: Documentation & Testing

**Status**: ⏳ Pending
**Priority**: HIGH

**Tasks**:
1. Write user documentation
2. Write developer documentation
3. Create API documentation
4. Write unit tests
5. Write integration tests
6. Write E2E tests
7. Create manual testing checklist

## File Type Support Matrix

| File Type | MIME Type | Preview Method | Status |
|-----------|-----------|----------------|--------|
| JPEG/PNG/GIF | image/* | `<img>` inline | Planned |
| PDF | application/pdf | iframe with /preview | Planned |
| Word | application/vnd.openxmlformats-officedocument.wordprocessingml.document | iframe with /preview | Planned |
| Excel | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | iframe with /preview | Planned |
| PowerPoint | application/vnd.openxmlformats-officedocument.presentationml.presentation | iframe with /preview | Planned |
| Google Doc | application/vnd.google-apps.document | iframe with /preview | Planned |
| Google Sheet | application/vnd.google-apps.spreadsheet | iframe with /preview | Planned |
| Google Slides | application/vnd.google-apps.presentation | iframe with /preview | Planned |
| Markdown | text/markdown | react-markdown (fetch content) | Planned |
| Text | text/plain | `<pre>` | Planned |
| CSV | text/csv | Table preview | Planned |
| JSON | application/json | Syntax highlighting | Planned |
| ZIP | application/zip | Download only | Planned |
| MP4 | video/mp4 | `<video>` player | Planned |
| MP3 | audio/mpeg | `<audio>` player | Planned |

## Google Drive API Quota Limits

**Per Project**:
- Queries per day: 1,000,000,000
- Queries per 100 seconds: 20,000
- Queries per 100 seconds per user: 1,000

**Note**: With caching and optimization, our usage should be well under these limits.

## Security Considerations

1. **Token Storage**: Refresh tokens encrypted at rest in database
2. **File Access**: Validate user has access before every operation
3. **XSS Prevention**: Sanitize file names and markdown content
4. **CORS**: Restrict Drive API calls to our domain
5. **Rate Limiting**: Prevent abuse with per-user limits

## Success Metrics

### Technical Metrics
- File upload success rate >99%
- Permission sharing success rate >95%
- Average upload time <5s for 10MB file
- Drive API error rate <1%
- Token refresh success rate >99%

### User Experience Metrics
- Users attach files in >30% of conversations
- File preview click-through rate >70%
- User satisfaction score >4.5/5

## Timeline

| Phase | Description | Time | Priority | Status |
|-------|-------------|------|----------|--------|
| 5.1 | OAuth & Drive API Setup | 2 days | Critical | ✅ Complete |
| 5.2 | Drive Service Layer | 3 days | Critical | ✅ Complete |
| 5.3 | Google Picker Integration | 2 days | High | ✅ Complete |
| 5.4 | File Upload Endpoint | 3 days | Critical | ✅ Complete |
| 5.5 | File Preview UI | 4 days | High | ✅ Complete |
| 5.6 | Thread & Real-time | 2 days | High | ✅ Complete |
| 5.7 | Error Handling | 2 days | High | ⏳ Pending |
| 5.8 | Performance | 2 days | Medium | ⏳ Pending |
| 5.9 | Documentation & Testing | 3 days | High | ⏳ Pending |
| **Total** | | **23 days** (~4.5 weeks) | | **~85% Complete** |

**With 4 Parallel Instances**: ~5-6 days (Core features completed in 1 day!)

## Next Steps

1. ✅ Instance #1: Complete (OAuth & Drive Service) - Commits: 970d2c1, 7797805, 2e4581f
2. ✅ Instance #2: Complete (Message Attachments API) - Uncommitted, needs minor fixes
3. ✅ Instance #3: Complete (Google Picker Integration) - Commit: 4579e9e
4. ✅ Instance #4: Complete (File Preview Components) - Commit: bcaa815
5. 🔧 Fix TypeScript errors (ThreadSidebar field name, Button imports)
6. 🔧 Implement markdown content endpoint
7. 🔧 Commit Instance #2 changes
8. ⏳ Integration testing across all components
9. ⏳ Phase 5.7: Error handling
10. ⏳ Phase 5.8: Performance optimization
11. ⏳ Phase 5.9: Documentation & testing
12. ⏳ Deploy to staging for user testing
13. ⏳ Production deployment

## References

- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [Google Picker API Documentation](https://developers.google.com/drive/picker)
- [Slack File Upload API](https://api.slack.com/messaging/files)
- [Microsoft Teams Files](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/share-in-meeting)

---

**Document Version**: 2.0
**Last Updated**: October 13, 2025
**Maintained By**: Development Team
