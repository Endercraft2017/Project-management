# Google Sheets Integration - Implementation Plan

## Overview

Implement bidirectional sync between PostgreSQL database and Google Sheets for task management data. Manual/button-triggered sync with conflict resolution and batch operations for performance.

## Research Summary (January 2025)

### Google Sheets API v4 Best Practices

**Authentication Approach**:
- **Service Account**: Recommended for server-side applications without user interaction
- Create service account in Google Cloud Console
- Generate JSON key file with credentials
- Share spreadsheet with service account email
- Use `google-auth-library` for authentication
- Store credentials securely (environment variables or secure file storage)

**Node.js Implementation**:
- Official library: `googleapis` npm package
- Supports OAuth 2.0, API Keys, and JWT (Service Tokens)
- Pass JWT client directly to Sheets client
- Enable Google Sheets API in Google Cloud Console

### Bidirectional Sync Strategies

**Conflict Resolution Approaches**:

1. **Last Writer Wins (LWW)** - Recommended for our use case
   - Latest modification is valid
   - Track `updatedAt` timestamps
   - Simple to implement
   - Works well when real-time collaboration isn't critical

2. **Timestamp-Based Resolution**
   - Each item has modification timestamp
   - Latest timestamp wins
   - Need to store last sync time

3. **Manual Conflict Resolution**
   - Show conflicts to user
   - Let admin choose which version to keep
   - More complex UI required

**Sync Direction Options**:
- **Database → Sheets** (Export): Overwrite sheets with DB data
- **Sheets → Database** (Import): Overwrite DB with sheets data
- **Bidirectional**: Merge changes, detect conflicts

**Our Approach**: Manual button-triggered sync with conflict detection and Last Writer Wins strategy.

### Performance Optimization

**Batch Operations**:
- Combine multiple operations into single API call
- `spreadsheets.values.batchUpdate`: Update multiple ranges
- `spreadsheets.values.batchGet`: Read multiple ranges
- Reduces network round trips by 95%
- Update 5000 cells in <2 seconds vs 15 seconds individual

**Best Practices**:
- Limit batch size to 100 API calls per request
- Aggregate changes into arrays
- Use range notation (A1:Z1000) for bulk operations
- Cache sheet metadata to avoid repeated reads

**Rate Limits**:
- 300 read requests per minute per user
- 300 write requests per minute per user
- Implement exponential backoff for rate limit errors

## Database Schema (Already Exists)

No changes needed. Existing Task model has all required fields:
```prisma
model Task {
  id             String    @id @default(uuid())
  taskName       String
  description    String?
  progress       Int       @default(0)
  startDate      DateTime?
  dueDate        DateTime?
  nestingLevel   Int       @default(0)
  parentTaskId   String?
  sprintId       String?
  assignedToId   String?
  createdById    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  // Relations...
}
```

## Google Sheets Structure

### Sheet Format

**Column Headers** (Row 1):
```
| Task ID | Task Name | Description | Progress % | Sprint | Assigned To | Start Date | Due Date | Nesting Level | Parent ID | Created At | Updated At |
```

**Data Rows** (2+):
```
| uuid | Setup Auth | Configure OAuth | 75 | Sprint 1 | John Doe | 2025-01-15 | 2025-01-20 | 0 | NULL | 2025-01-10 | 2025-01-18 |
```

**Sheet Name**: "Tasks"

### Field Mapping

| Database Field | Sheets Column | Format |
|----------------|---------------|---------|
| id | A (Task ID) | UUID string |
| taskName | B (Task Name) | String |
| description | C (Description) | String |
| progress | D (Progress %) | Number (0-100) |
| sprintId | E (Sprint) | Sprint name (lookup) |
| assignedToId | F (Assigned To) | User name (lookup) |
| startDate | G (Start Date) | YYYY-MM-DD |
| dueDate | H (Due Date) | YYYY-MM-DD |
| nestingLevel | I (Nesting Level) | Number (0-3) |
| parentTaskId | J (Parent ID) | UUID string or NULL |
| createdAt | K (Created At) | ISO 8601 timestamp |
| updatedAt | L (Updated At) | ISO 8601 timestamp |

## API Endpoints

### 1. Export to Google Sheets
**POST** `/api/sync/export-to-sheets`

**Authorization**: Admin only

**Request Body**:
```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "sheetName": "Tasks",
  "overwrite": true
}
```

**Validation Rules**:
- `spreadsheetId`: Required, valid Google Sheets ID format
- `sheetName`: Optional, default "Tasks", 1-100 characters
- `overwrite`: Optional, boolean, default true

**Business Logic**:
1. Authenticate with Google Sheets API using service account
2. Verify spreadsheet exists and is accessible
3. If `overwrite=true`: Clear existing data (keep headers)
4. Fetch all tasks from database with relations
5. Transform tasks to sheet format (map IDs to names)
6. Batch update sheets with all data
7. Record sync metadata (timestamp, record count)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Tasks exported to Google Sheets successfully",
  "data": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Tasks",
    "recordsExported": 124,
    "syncedAt": "2025-01-20T15:30:00Z",
    "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
  }
}
```

**Errors**:
- `401`: Not authenticated
- `403`: Not admin or spreadsheet access denied
- `400`: Invalid spreadsheet ID or validation error
- `404`: Spreadsheet not found
- `500`: Google Sheets API error

---

### 2. Import from Google Sheets
**POST** `/api/sync/import-from-sheets`

**Authorization**: Admin only

**Request Body**:
```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "sheetName": "Tasks",
  "conflictStrategy": "lastWriterWins"
}
```

**Validation Rules**:
- `spreadsheetId`: Required, valid format
- `sheetName`: Optional, default "Tasks"
- `conflictStrategy`: Optional, enum: 'lastWriterWins' | 'skipConflicts' | 'overwriteAll', default 'lastWriterWins'

**Business Logic**:
1. Authenticate with Google Sheets API
2. Verify spreadsheet access
3. Read all rows from sheet (batch get)
4. Parse and validate each row
5. For each task:
   - Check if exists in DB (by Task ID)
   - If exists: Apply conflict strategy
   - If not exists: Create new task
6. Handle lookups (sprint names → IDs, user names → IDs)
7. Use transaction for atomicity
8. Record sync metadata

**Conflict Strategies**:
- **lastWriterWins**: Compare `updatedAt`, use newer version
- **skipConflicts**: Skip rows with conflicts, import only new/unchanged
- **overwriteAll**: Always use sheets data (dangerous)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Tasks imported from Google Sheets successfully",
  "data": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Tasks",
    "recordsImported": 10,
    "recordsUpdated": 8,
    "recordsSkipped": 2,
    "conflicts": [
      {
        "taskId": "uuid",
        "taskName": "Setup Auth",
        "reason": "Database version newer than sheets",
        "action": "skipped"
      }
    ],
    "syncedAt": "2025-01-20T15:35:00Z"
  }
}
```

**Errors**:
- Similar to export endpoint
- `400`: Invalid data format in sheets, validation errors

---

### 3. Bidirectional Sync
**POST** `/api/sync/bidirectional`

**Authorization**: Admin only

**Request Body**:
```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "sheetName": "Tasks",
  "conflictStrategy": "lastWriterWins"
}
```

**Business Logic**:
1. Get last sync timestamp from database
2. Read sheets data
3. Read DB data
4. Compare timestamps to detect changes since last sync:
   - **DB changes**: Tasks with `updatedAt > lastSyncTime`
   - **Sheets changes**: Compare current sheets data with cached previous state
5. Merge changes:
   - If only DB changed: Update sheets
   - If only sheets changed: Update DB
   - If both changed: Apply conflict strategy
6. Update both systems atomically
7. Record new sync timestamp

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Bidirectional sync completed successfully",
  "data": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "dbToSheets": {
      "created": 5,
      "updated": 3
    },
    "sheetsToDb": {
      "created": 2,
      "updated": 4
    },
    "conflicts": 1,
    "conflictsResolved": 1,
    "syncedAt": "2025-01-20T15:40:00Z"
  }
}
```

---

### 4. Get Sync Status
**GET** `/api/sync/status`

**Authorization**: Admin only

**Query Parameters**:
- `spreadsheetId` (optional): Filter by spreadsheet

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "lastSync": {
      "id": "sync-uuid",
      "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      "sheetName": "Tasks",
      "syncType": "bidirectional",
      "recordsExported": 124,
      "recordsImported": 6,
      "conflicts": 1,
      "status": "completed",
      "syncedAt": "2025-01-20T15:40:00Z",
      "duration": 3500
    },
    "syncHistory": [
      {
        "syncedAt": "2025-01-20T15:40:00Z",
        "syncType": "bidirectional",
        "status": "completed"
      }
    ],
    "nextSyncRecommended": "2025-01-21T15:40:00Z",
    "isConfigured": true,
    "serviceAccountEmail": "project-name@project-id.iam.gserviceaccount.com"
  }
}
```

---

## Validation Schemas (Zod)

### Export Schema
```typescript
export const exportToSheetsSchema = z.object({
  spreadsheetId: z.string().regex(/^[a-zA-Z0-9_-]{44}$/, 'Invalid spreadsheet ID'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  overwrite: z.boolean().default(true),
});
```

### Import Schema
```typescript
export const importFromSheetsSchema = z.object({
  spreadsheetId: z.string().regex(/^[a-zA-Z0-9_-]{44}$/, 'Invalid spreadsheet ID'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  conflictStrategy: z.enum(['lastWriterWins', 'skipConflicts', 'overwriteAll']).default('lastWriterWins'),
});
```

### Bidirectional Sync Schema
```typescript
export const bidirectionalSyncSchema = z.object({
  spreadsheetId: z.string().regex(/^[a-zA-Z0-9_-]{44}$/, 'Invalid spreadsheet ID'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  conflictStrategy: z.enum(['lastWriterWins', 'skipConflicts', 'overwriteAll']).default('lastWriterWins'),
});
```

---

## Service Layer Functions

### Google Sheets Client Setup
```typescript
class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets;
  private auth: JWT;

  constructor() {
    this.auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async verifyAccess(spreadsheetId: string): Promise<boolean> { ... }
  async readSheet(spreadsheetId: string, range: string): Promise<any[][]> { ... }
  async batchUpdateSheet(spreadsheetId: string, data: any[][]): Promise<void> { ... }
  async clearSheet(spreadsheetId: string, range: string): Promise<void> { ... }
}
```

### Sync Service Functions

**`exportToSheets(spreadsheetId, sheetName, overwrite)`**:
1. Initialize Google Sheets client
2. Verify spreadsheet access
3. Fetch all tasks from DB with includes (sprint, assignedTo, createdBy)
4. Transform to sheet rows
5. If overwrite: Clear existing data
6. Batch update with formatted data
7. Create sync log entry
8. Return result

**`importFromSheets(spreadsheetId, sheetName, conflictStrategy)`**:
1. Initialize Google Sheets client
2. Read all rows from sheet
3. Parse and validate each row
4. Build lookup maps (sprint names, user names)
5. For each row:
   - Find or create task
   - Apply conflict strategy if exists
   - Collect conflicts
6. Transaction: Update/create all tasks
7. Create sync log entry
8. Return result with conflicts

**`bidirectionalSync(spreadsheetId, sheetName, conflictStrategy)`**:
1. Get last sync timestamp
2. Find DB changes (updatedAt > lastSync)
3. Read current sheets data
4. Compare with previous sheets snapshot
5. Identify conflicts (both changed)
6. Merge changes:
   - DB → Sheets for DB-only changes
   - Sheets → DB for sheets-only changes
   - Apply conflict strategy for both
7. Transaction: Update both systems
8. Store new sheets snapshot
9. Create sync log entry

**Helper Functions**:
- `transformTaskToSheetRow(task)`: Convert task to array format
- `parseSheetRowToTask(row)`: Convert array to task object
- `resolveSprintName(sprintId)`: Get sprint name from ID
- `resolveSprint(name)`: Get sprint ID from name
- `resolveUserName(userId)`: Get user name from ID
- `resolveUser(name)`: Get user ID from name
- `detectConflict(dbTask, sheetTask, lastSync)`: Determine if conflict exists

---

## Database Model for Sync Logs

Add new model to track sync history:

```prisma
model SyncLog {
  id              String   @id @default(uuid())
  spreadsheetId   String
  sheetName       String
  syncType        String   // 'export', 'import', 'bidirectional'
  recordsExported Int      @default(0)
  recordsImported Int      @default(0)
  recordsUpdated  Int      @default(0)
  recordsSkipped  Int      @default(0)
  conflicts       Int      @default(0)
  status          String   // 'completed', 'failed', 'partial'
  error           String?  @db.Text
  duration        Int      // milliseconds
  performedById   String
  createdAt       DateTime @default(now())

  performedBy     User     @relation(fields: [performedById], references: [id])

  @@index([spreadsheetId])
  @@index([createdAt])
}
```

Update User model to add relation:
```prisma
model User {
  // ... existing fields
  syncLogs        SyncLog[]
}
```

---

## Controller Layer

Each controller:
1. Validates input (Zod)
2. Verifies admin authorization
3. Calls service layer with error handling
4. Returns standardized response
5. Logs sync operations

**Example: Export Controller**:
```typescript
async exportToSheets(req: Request, res: Response, next: NextFunction) {
  try {
    const data = exportToSheetsSchema.parse(req.body);
    const userId = req.user!.id;

    const startTime = Date.now();
    const result = await syncService.exportToSheets(
      data.spreadsheetId,
      data.sheetName,
      data.overwrite,
      userId
    );
    const duration = Date.now() - startTime;

    console.log(`Sheets export: ${result.recordsExported} tasks by ${req.user?.email} (${duration}ms)`);

    res.json({
      success: true,
      message: 'Tasks exported to Google Sheets successfully',
      data: result,
    });
  } catch (error) {
    // Handle Google API errors, validation errors, etc.
    next(error);
  }
}
```

---

## Routes Configuration

```typescript
import { Router } from 'express';
import { syncController } from './controller';
import { isAuthenticated, isAdmin } from '@/auth/middleware';

const router = Router();

// All sync operations require admin
router.post('/export-to-sheets', isAuthenticated, isAdmin, syncController.exportToSheets);
router.post('/import-from-sheets', isAuthenticated, isAdmin, syncController.importFromSheets);
router.post('/bidirectional', isAuthenticated, isAdmin, syncController.bidirectionalSync);
router.get('/status', isAuthenticated, isAdmin, syncController.getSyncStatus);

export default router;
```

---

## Environment Variables

Add to `.env`:
```env
# Google Sheets API
GOOGLE_SERVICE_ACCOUNT_EMAIL=project-name@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SHEET_NAME=Tasks
```

---

## Testing Strategy

### Unit Tests (Service Layer)

1. **transformTaskToSheetRow**: Verify format, handle null values
2. **parseSheetRowToTask**: Parse each field, validate dates
3. **resolveSprintName / resolveSprint**: Test lookups
4. **detectConflict**: Test timestamp comparison logic

### Integration Tests

1. **Export to Sheets**:
   - Export empty database
   - Export with tasks
   - Verify sheet format
   - Test overwrite vs append

2. **Import from Sheets**:
   - Import valid data
   - Import with validation errors
   - Test conflict strategies
   - Test new task creation

3. **Bidirectional Sync**:
   - Both systems unchanged
   - Only DB changed
   - Only sheets changed
   - Both changed (conflict)
   - Multiple conflicts

4. **Authorization**:
   - Deny non-admin access
   - Test spreadsheet access permissions

5. **Error Handling**:
   - Invalid spreadsheet ID
   - Spreadsheet not found
   - No access to spreadsheet
   - Google API errors
   - Rate limit handling

---

## Files to Create

1. **server/src/sync/client.ts** - Google Sheets API client wrapper
2. **server/src/sync/mapper.ts** - Transform between DB and Sheets format
3. **server/src/sync/service.ts** - Sync business logic
4. **server/src/sync/controller.ts** - Request handlers
5. **server/src/sync/routes.ts** - Route definitions
6. **server/src/sync/validators.ts** - Zod schemas
7. **server/src/app.ts** - Add sync routes
8. **server/database/prisma/schema.prisma** - Add SyncLog model
9. **tests/feature/google-sheets.test.ts** - Integration tests
10. **tests/CI_CD/google-sheets-ci.yml** - CI/CD workflow
11. **docs/documentation/06-google-sheets.md** - Full documentation

---

## Security Considerations

1. **Service Account Key**: Store securely, never commit to git
2. **Admin Only**: All sync operations require admin role
3. **Audit Logging**: Log all sync operations with user info
4. **Rate Limiting**: Respect Google API rate limits
5. **Input Validation**: Validate all sheet data before importing
6. **Transaction Safety**: Use DB transactions for imports

---

## Performance Optimizations

1. **Batch Operations**: Use batchUpdate for sheets, bulk insert for DB
2. **Parallel Processing**: Process rows in parallel where safe
3. **Caching**: Cache sprint/user lookups during sync
4. **Incremental Sync**: Only sync changed records (for bidirectional)
5. **Connection Pooling**: Reuse Google Sheets client

---

## Error Handling

### Google API Errors
- `PERMISSION_DENIED`: Spreadsheet not shared with service account
- `NOT_FOUND`: Spreadsheet ID doesn't exist
- `RATE_LIMIT_EXCEEDED`: Implement exponential backoff
- `INVALID_ARGUMENT`: Invalid range or data format

### Application Errors
- **Validation errors**: Return 400 with details
- **Conflict errors**: Return in conflicts array, not as error
- **Transaction failures**: Rollback DB changes
- **Partial failures**: Return partial success with error details

---

## Implementation Order

1. ✅ Research best practices
2. ✅ Create plan document
3. Create Prisma migration for SyncLog model
4. Create Google Sheets client wrapper (client.ts)
5. Create data mapper (mapper.ts)
6. Create validators (validators.ts)
7. Create service layer (service.ts)
8. Create controller (controller.ts)
9. Create routes (routes.ts)
10. Add routes to app.ts
11. Create integration tests
12. Create CI/CD workflow
13. Create documentation

---

**Created**: January 2025
**Status**: Ready for Implementation
**Estimated Effort**: 4-5 hours
