# Google Sheets Integration API Documentation

## Overview

The Google Sheets Integration provides bidirectional sync capabilities between the ServiceBay PM database and Google Sheets. This feature enables teams to work with task data in spreadsheets while maintaining synchronization with the primary database. The integration supports manual/button-triggered sync operations, conflict resolution strategies, and batch processing for optimal performance.

### Key Features

- **Bidirectional Sync**: Changes flow both ways between database and Google Sheets
- **Manual Trigger**: Admin-initiated sync operations (no automatic background sync)
- **Conflict Resolution**: Three strategies to handle simultaneous updates
- **Batch Operations**: Efficient bulk data transfer using Google Sheets API v4
- **Service Account Auth**: Server-side authentication without user interaction
- **Audit Logging**: Complete history of all sync operations
- **Admin-Only Access**: Restricted to administrators for security

### Use Cases

- **External Reporting**: Share task data with stakeholders without database access
- **Bulk Editing**: Update multiple tasks efficiently in spreadsheet format
- **Data Export**: Create backups or reports in familiar spreadsheet format
- **Collaboration**: Allow team members to work in Google Sheets offline
- **Import**: Bulk import tasks from external sources via spreadsheet

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Admin UI)                      │
│              Sync Buttons + Status Dashboard                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   Sync Controller Layer                      │
│          Request validation + Response formatting            │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    Sync Service Layer                        │
│    Business Logic + Conflict Resolution + Orchestration      │
└──────┬──────────────────────────────────────────┬───────────┘
       │                                           │
       │                                           │
┌──────▼────────────────┐              ┌──────────▼───────────┐
│   Database Layer      │              │  Google Sheets API   │
│   (PostgreSQL)        │              │     Client Layer     │
│   via Prisma ORM      │              │   (googleapis v4)    │
└───────────────────────┘              └──────────────────────┘
       │                                           │
       │                                           │
┌──────▼────────────────┐              ┌──────────▼───────────┐
│   Task + SyncLog      │              │   Google Sheets      │
│      Tables           │              │    Spreadsheet       │
└───────────────────────┘              └──────────────────────┘
```

### Layer Responsibilities

1. **Controller Layer** (`controller.ts`):
   - HTTP request/response handling
   - Input validation using Zod schemas
   - Error handling and formatting
   - Performance timing and logging
   - User authentication verification

2. **Service Layer** (`service.ts`):
   - Core sync orchestration logic
   - Conflict detection and resolution
   - Data transformation coordination
   - Transaction management
   - Sync log creation

3. **Mapper Layer** (`mapper.ts`):
   - Database ↔ Sheets data transformation
   - Field mapping (IDs to names, date formatting)
   - Validation of sheet structure
   - Conflict detection algorithms
   - Lookup cache management

4. **Client Layer** (`client.ts`):
   - Google Sheets API wrapper
   - Service account authentication
   - Batch operations optimization
   - Error handling for API calls
   - Rate limit management

### Component Files

```
server/src/sync/
├── routes.ts           # API endpoint definitions
├── controller.ts       # Request/response handlers
├── service.ts          # Business logic and orchestration
├── mapper.ts           # Data transformation layer
├── client.ts           # Google Sheets API client
└── validators.ts       # Zod input validation schemas
```

## Setup

### Prerequisites

1. Google Cloud Project with Sheets API enabled
2. Service account with JSON credentials
3. Spreadsheet shared with service account email
4. Node.js environment with googleapis package

### Service Account Configuration

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing project
3. Navigate to "APIs & Services" → "Library"
4. Search for "Google Sheets API" and enable it

#### Step 2: Create Service Account

1. Navigate to "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Enter service account details:
   - Name: `servicebay-pm-sync`
   - Description: `Service account for task sync with Google Sheets`
4. Click "Create and Continue"
5. Skip role assignment (not needed for this use case)
6. Click "Done"

#### Step 3: Generate Credentials

1. Click on the newly created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Select "JSON" format
5. Download the JSON file (keep it secure!)
6. Extract two values from JSON:
   - `client_email` → Service account email
   - `private_key` → Private key (multi-line string)

#### Step 4: Share Spreadsheet

1. Open your Google Sheets spreadsheet
2. Click "Share" button
3. Enter the service account email (from `client_email`)
4. Grant "Editor" permission
5. Uncheck "Notify people" (service accounts don't receive emails)
6. Click "Share"

#### Step 5: Configure Environment Variables

Add to your `.env` file:

```bash
# Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_EMAIL=servicebay-pm-sync@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**Important**:
- Keep private key confidential (never commit to version control)
- Use multi-line string format with `\n` for line breaks
- Quotes are required for private key

#### Step 6: Verify Configuration

Test your configuration:

```bash
# Check environment variables are loaded
node -e "console.log(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)"

# Expected output: your-service-account@project.iam.gserviceaccount.com
```

### Spreadsheet Setup

#### Initial Structure

Create a new spreadsheet or use existing one with this structure:

**Sheet Name**: `Tasks` (default, configurable)

**Headers (Row 1)**:
```
| Task ID | Task Name | Details | Progress % | Sprint | Assigned To | Start Date | Deadline | Nesting Level | Parent ID | Created At | Updated At |
```

**Example Data (Row 2+)**:
```
| abc-123 | Setup Auth | Configure OAuth2 | 75 | Sprint 1 | John Doe | 2025-01-15 | 2025-01-20 | 0 | | 2025-01-10T10:00:00Z | 2025-01-18T14:30:00Z |
```

#### Column Details

| Column | Field | Type | Required | Format | Notes |
|--------|-------|------|----------|--------|-------|
| A | Task ID | UUID | Yes | UUID v4 | Primary key |
| B | Task Name | String | Yes | Text | Max 200 chars |
| C | Details | String | No | Text | Max 5000 chars |
| D | Progress % | Number | Yes | 0-100 | Integer |
| E | Sprint | String | Yes | Sprint name | Lookup from DB |
| F | Assigned To | String | Yes | User name | Lookup from DB |
| G | Start Date | Date | Yes | YYYY-MM-DD | ISO format accepted |
| H | Deadline | Date | Yes | YYYY-MM-DD | Must be > Start Date |
| I | Nesting Level | Number | Yes | 0-3 | Hierarchy depth |
| J | Parent ID | UUID | No | UUID v4 | Null for top-level |
| K | Created At | Timestamp | No | ISO 8601 | Read-only |
| L | Updated At | Timestamp | No | ISO 8601 | For conflict detection |

#### Best Practices

1. **Don't modify Task ID**: IDs are immutable identifiers
2. **Use existing Sprint names**: Must match database exactly
3. **Use existing User names**: Must match database exactly
4. **Respect date order**: Deadline must be after Start Date
5. **Keep nesting level correct**: 0 (top) to 3 (deepest)
6. **Preserve timestamps**: Don't edit Created At / Updated At manually

## Sheet Format

### Field Mapping Table

Complete mapping between database fields and spreadsheet columns:

| Database Field | Sheets Column | Direction | Transformation |
|----------------|---------------|-----------|----------------|
| id | A: Task ID | Both | UUID string (no change) |
| taskName | B: Task Name | Both | String (trimmed) |
| details | C: Details | Both | String or empty string (null → "") |
| progress | D: Progress % | Both | Integer 0-100 (validation applied) |
| sprint.name | E: Sprint | Both | **Name → ID** (import), **ID → Name** (export) |
| assignedTo.name | F: Assigned To | Both | **Name → ID** (import), **ID → Name** (export) |
| startDate | G: Start Date | Both | **String → Date** (import), **Date → YYYY-MM-DD** (export) |
| deadline | H: Deadline | Both | **String → Date** (import), **Date → YYYY-MM-DD** (export) |
| nestingLevel | I: Nesting Level | Both | Integer 0-3 (validation applied) |
| parentTaskId | J: Parent ID | Both | UUID string or empty (null → "") |
| createdAt | K: Created At | Both | **String → Date** (import), **Date → ISO 8601** (export) |
| updatedAt | L: Updated At | Both | **String → Date** (import), **Date → ISO 8601** (export) |

### Data Transformation Examples

#### Export (Database → Sheets)

```javascript
// Database record
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  taskName: "Implement login",
  details: "Create OAuth2 login flow",
  progress: 75,
  sprintId: "abc-123-sprint",
  assignedToId: "user-456",
  startDate: Date("2025-01-15T00:00:00Z"),
  deadline: Date("2025-01-20T23:59:59Z"),
  nestingLevel: 0,
  parentTaskId: null,
  sprint: { name: "Sprint 1" },
  assignedTo: { name: "John Doe" }
}

// Transformed to sheet row
[
  "550e8400-e29b-41d4-a716-446655440000",  // Task ID
  "Implement login",                        // Task Name
  "Create OAuth2 login flow",               // Details
  75,                                       // Progress %
  "Sprint 1",                               // Sprint (name)
  "John Doe",                               // Assigned To (name)
  "2025-01-15",                             // Start Date (YYYY-MM-DD)
  "2025-01-20",                             // Deadline (YYYY-MM-DD)
  0,                                        // Nesting Level
  "",                                       // Parent ID (empty for null)
  "2025-01-10T10:00:00.000Z",              // Created At (ISO)
  "2025-01-18T14:30:00.000Z"               // Updated At (ISO)
]
```

#### Import (Sheets → Database)

```javascript
// Sheet row
[
  "550e8400-e29b-41d4-a716-446655440000",
  "Implement login - Updated",
  "Create OAuth2 login flow with MFA",
  85,
  "Sprint 1",
  "Jane Smith",
  "2025-01-15",
  "2025-01-22",
  0,
  "",
  "2025-01-10T10:00:00.000Z",
  "2025-01-19T09:00:00.000Z"
]

// Transformation process
// 1. Lookup sprint by name
const sprint = await prisma.sprint.findFirst({
  where: { name: "Sprint 1" }
});
// sprint.id = "abc-123-sprint"

// 2. Lookup user by name
const user = await prisma.user.findFirst({
  where: { name: "Jane Smith" }
});
// user.id = "user-789"

// 3. Parse dates
const startDate = new Date("2025-01-15");
const deadline = new Date("2025-01-22");

// 4. Build task object
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  taskName: "Implement login - Updated",
  details: "Create OAuth2 login flow with MFA",
  progress: 85,
  sprintId: "abc-123-sprint",        // Resolved from name
  assignedToId: "user-789",          // Resolved from name
  startDate: startDate,
  deadline: deadline,
  nestingLevel: 0,
  parentTaskId: null,                // Empty string → null
  updatedAt: new Date()              // Current timestamp
}
```

### Validation Rules

Applied during both import and export:

1. **Task ID**: Must be valid UUID v4 format
2. **Task Name**: Required, 1-200 characters, trimmed
3. **Details**: Optional, max 5000 characters, trimmed
4. **Progress**: Required, integer 0-100 inclusive
5. **Sprint**: Must exist in database (validated by name lookup)
6. **Assigned To**: Must exist in database (validated by name lookup)
7. **Start Date**: Required, valid date format, cannot be in far past
8. **Deadline**: Required, valid date format, must be > Start Date
9. **Nesting Level**: Required, integer 0-3 inclusive
10. **Parent ID**: Optional, must be valid UUID or empty
11. **Timestamps**: ISO 8601 format, validated but not modified

## API Endpoints

All sync endpoints require admin authentication and are rate-limited.

### Base URL
```
/api/sync
```

---

### 1. Export to Google Sheets

**POST** `/api/sync/export-to-sheets`

Export all tasks from the database to a Google Sheets spreadsheet. This operation overwrites or appends to the sheet based on the `overwrite` parameter.

**Authorization**: Admin only

**Request Body**:
```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "sheetName": "Tasks",
  "overwrite": true
}
```

**Request Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| spreadsheetId | string | Yes | - | 44-character Google Sheets ID from URL |
| sheetName | string | No | "Tasks" | Target sheet name (1-100 chars, trimmed) |
| overwrite | boolean | No | true | Clear existing data before export |

**Validation Rules**:
- `spreadsheetId`: Must match regex `/^[a-zA-Z0-9_-]{44}$/`
- `sheetName`: Min 1, max 100 characters, trimmed, defaults to "Tasks"
- `overwrite`: Boolean, defaults to true

**Business Logic Flow**:
```
1. Validate request parameters
2. Authenticate with Google Sheets API (service account)
3. Verify spreadsheet exists and is accessible
4. Check if sheet exists, create if missing
5. If overwrite=true: Clear sheet range A1:Z (preserve formatting)
6. Fetch all tasks from database with relations (sprint, assignedTo)
7. Transform tasks to sheet format:
   - Convert IDs to names (sprint, user)
   - Format dates as YYYY-MM-DD
   - Convert nulls to empty strings
8. Build data array: [headers, ...taskRows]
9. Batch write to sheet starting at A1
10. Format headers: bold text, freeze first row
11. Create SyncLog entry (type: 'export', status: 'completed')
12. Return success response with statistics
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Tasks exported to Google Sheets successfully",
  "data": {
    "recordsExported": 124,
    "recordsImported": 0,
    "recordsUpdated": 0,
    "recordsSkipped": 0,
    "conflicts": [],
    "syncLogId": "sync-uuid-123",
    "duration": 2341
  }
}
```

**Response Fields**:
- `recordsExported`: Number of tasks written to sheet
- `syncLogId`: UUID of created sync log entry
- `duration`: Operation time in milliseconds

**Error Responses**:

`401 Unauthorized`:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

`403 Forbidden` (not admin):
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Admin access required"
}
```

`403 Forbidden` (spreadsheet access denied):
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Access denied. Please share the spreadsheet with the service account email."
}
```

`400 Bad Request` (validation error):
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input",
  "details": [
    {
      "code": "invalid_string",
      "path": ["spreadsheetId"],
      "message": "Invalid Google Sheets spreadsheet ID format"
    }
  ]
}
```

`404 Not Found`:
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Spreadsheet not found"
}
```

`500 Internal Server Error` (missing service account):
```json
{
  "success": false,
  "error": "Configuration Error",
  "message": "Google Sheets API is not properly configured. Please check service account credentials."
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/sync/export-to-sheets" \
  -H "Cookie: connect.sid=your-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Tasks",
    "overwrite": true
  }'
```

**Audit Log Entry**:
```
[Sync] Export to sheets started by admin@servicebay.ai: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
[SyncService] Starting export to sheet: Tasks
[SyncService] Spreadsheet access verified
[SyncService] Found 124 tasks to export
[SyncService] Writing 125 rows to sheet
[SyncService] Export completed in 2341ms
[Sync] Export completed: 124 tasks exported in 2341ms by admin@servicebay.ai
```

---

### 2. Import from Google Sheets

**POST** `/api/sync/import-from-sheets`

Import tasks from a Google Sheets spreadsheet to the database. Creates new tasks or updates existing ones based on Task ID. Applies conflict resolution strategy when both sources have been modified.

**Authorization**: Admin only

**Request Body**:
```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "sheetName": "Tasks",
  "conflictStrategy": "lastWriterWins"
}
```

**Request Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| spreadsheetId | string | Yes | - | Google Sheets spreadsheet ID |
| sheetName | string | No | "Tasks" | Source sheet name |
| conflictStrategy | enum | No | "lastWriterWins" | How to handle conflicts |

**Conflict Strategy Options**:
- `lastWriterWins`: Compare `updatedAt` timestamps, keep newest
- `skipConflicts`: Skip any task that exists in DB (import new only)
- `overwriteAll`: Always use sheet data, ignore DB timestamps

**Business Logic Flow**:
```
1. Validate request parameters
2. Authenticate with Google Sheets API
3. Verify spreadsheet and sheet exist
4. Read all rows from sheet (range A1:Z)
5. Validate headers match expected structure
6. Parse each row to task object:
   - Validate required fields (ID, name, etc.)
   - Lookup sprint ID from name
   - Lookup user ID from name
   - Parse and validate dates
   - Handle validation errors (collect, continue)
7. Get last sync timestamp for conflict detection
8. For each valid task:
   a. Check if task exists in database (by ID)
   b. If exists:
      - Detect conflict (both updated since last sync?)
      - Apply conflict resolution strategy
      - Skip or update based on resolution
   c. If new:
      - Create new task record
9. Execute all operations in database transaction
10. Create SyncLog entry with statistics
11. Return results with conflict details
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Tasks imported from Google Sheets successfully",
  "data": {
    "recordsExported": 0,
    "recordsImported": 15,
    "recordsUpdated": 32,
    "recordsSkipped": 3,
    "conflicts": [
      {
        "taskId": "task-uuid-456",
        "taskName": "Update API endpoints",
        "resolution": "useDb",
        "reason": "Both database and sheet were updated since last sync"
      }
    ],
    "syncLogId": "sync-uuid-789",
    "duration": 4523
  }
}
```

**Response Fields**:
- `recordsImported`: Number of new tasks created
- `recordsUpdated`: Number of existing tasks updated
- `recordsSkipped`: Number of tasks skipped (conflicts or errors)
- `conflicts`: Array of conflict details
  - `taskId`: UUID of conflicting task
  - `taskName`: Name for reference
  - `resolution`: How conflict was resolved (useDb, useSheet, skip)
  - `reason`: Explanation of conflict

**Error Responses**:

`400 Bad Request` (invalid sheet format):
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid sheet headers. Please ensure the sheet has the correct column structure."
}
```

`400 Bad Request` (invalid conflict strategy):
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input",
  "details": [
    {
      "code": "invalid_enum_value",
      "path": ["conflictStrategy"],
      "message": "Invalid enum value. Expected 'lastWriterWins' | 'skipConflicts' | 'overwriteAll'"
    }
  ]
}
```

`404 Not Found` (sheet not found):
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Sheet \"InvalidName\" not found in spreadsheet"
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/sync/import-from-sheets" \
  -H "Cookie: connect.sid=your-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Tasks",
    "conflictStrategy": "lastWriterWins"
  }'
```

**Audit Log Entry**:
```
[Sync] Import from sheets started by admin@servicebay.ai: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
[SyncService] Starting import from sheet: Tasks
[SyncService] Reading sheet data
[SyncService] Parsing 50 rows
[SyncService] Successfully parsed 47 tasks
[SyncService] Import completed in 4523ms
[Sync] Import completed: 15 imported, 32 updated, 3 conflicts in 4523ms by admin@servicebay.ai
```

---

### 3. Bidirectional Sync

**POST** `/api/sync/bidirectional`

Perform intelligent bidirectional sync between database and Google Sheets. Detects changes in both directions, applies conflict resolution, and ensures both sources reach consistent state.

**Authorization**: Admin only

**Request Body**:
```json
{
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "sheetName": "Tasks",
  "conflictStrategy": "lastWriterWins"
}
```

**Request Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| spreadsheetId | string | Yes | - | Google Sheets spreadsheet ID |
| sheetName | string | No | "Tasks" | Target sheet name |
| conflictStrategy | enum | No | "lastWriterWins" | Conflict resolution strategy |

**Business Logic Flow**:
```
1. Validate request parameters
2. Get last sync timestamp from SyncLog
3. Read all tasks from Google Sheets
4. Fetch all tasks from database
5. Create task maps (ID → Task) for both sources
6. Identify changes:
   a. DB-only changes: Tasks in DB but not in sheet
   b. Sheet-only changes: Tasks in sheet but not in DB
   c. Both changed: Tasks modified in both since last sync
7. Process changes in transaction:
   a. For DB-only: Mark for sheet update
   b. For sheet-only: Create or update in DB
   c. For conflicts:
      - Apply conflict resolution strategy
      - Track in conflicts array
8. Update sheet with final database state (full refresh)
9. Create SyncLog entry
10. Return comprehensive statistics
```

**Change Detection Logic**:
```javascript
// Pseudo-code for bidirectional sync
const lastSync = await getLastSyncTime(spreadsheetId);

for (const [taskId, dbTask] of dbTasksMap) {
  const sheetTask = sheetTasksMap.get(taskId);

  if (!sheetTask) {
    // Task exists only in DB → Export to sheet
    dbOnlyChanges.push(taskId);
  } else {
    // Task exists in both → Check for conflict
    const dbUpdated = dbTask.updatedAt > lastSync;
    const sheetUpdated = sheetTask.updatedAt > lastSync;

    if (dbUpdated && sheetUpdated) {
      // Both modified since last sync → Conflict
      bothChanged.push(taskId);
    }
  }
}

for (const taskId of sheetTasksMap.keys()) {
  if (!dbTasksMap.has(taskId)) {
    // Task exists only in sheet → Import to DB
    sheetOnlyChanges.push(taskId);
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Bidirectional sync completed successfully",
  "data": {
    "recordsExported": 8,
    "recordsImported": 5,
    "recordsUpdated": 12,
    "recordsSkipped": 2,
    "conflicts": [
      {
        "taskId": "task-uuid-123",
        "taskName": "Design homepage",
        "resolution": "useSheet",
        "reason": "Both database and sheet were updated since last sync"
      }
    ],
    "syncLogId": "sync-uuid-999",
    "duration": 5847
  }
}
```

**Response Fields**:
- `recordsExported`: Tasks added/updated in sheet from DB
- `recordsImported`: New tasks created in DB from sheet
- `recordsUpdated`: Existing DB tasks updated from sheet
- `recordsSkipped`: Tasks skipped due to conflicts
- `conflicts`: Detailed conflict information

**Detailed Sync Response** (Extended):
```json
{
  "success": true,
  "message": "Bidirectional sync completed successfully",
  "data": {
    "dbToSheets": {
      "created": 8,
      "updated": 0
    },
    "sheetsToDb": {
      "created": 5,
      "updated": 12
    },
    "conflicts": 2,
    "recordsExported": 8,
    "recordsImported": 5,
    "recordsUpdated": 12,
    "recordsSkipped": 2,
    "conflicts": [
      {
        "taskId": "task-uuid-123",
        "taskName": "Design homepage",
        "resolution": "useSheet",
        "reason": "Both database and sheet were updated since last sync"
      }
    ],
    "syncLogId": "sync-uuid-999",
    "duration": 5847
  }
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/sync/bidirectional" \
  -H "Cookie: connect.sid=your-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheetName": "Tasks",
    "conflictStrategy": "lastWriterWins"
  }'
```

**Audit Log Entry**:
```
[Sync] Bidirectional sync started by admin@servicebay.ai: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
[SyncService] Starting bidirectional sync for sheet: Tasks
[SyncService] Last sync time: 2025-01-19T10:00:00.000Z
[SyncService] Found 124 valid tasks in sheet
[SyncService] Found 131 tasks in database
[SyncService] Changes detected - DB: 8, Sheet: 5, Both: 2
[SyncService] Updating sheet with final state
[SyncService] Bidirectional sync completed in 5847ms
[Sync] Bidirectional sync completed: DB→Sheets(8/0), Sheets→DB(5/12), conflicts: 2 in 5847ms by admin@servicebay.ai
```

---

### 4. Get Sync Status

**GET** `/api/sync/status`

Retrieve sync history and current configuration status. Provides visibility into past sync operations and system health.

**Authorization**: Admin only

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| spreadsheetId | string | No | - | Filter by specific spreadsheet |
| limit | number | No | 10 | Number of history entries (1-100) |

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "lastSync": {
      "id": "sync-uuid-999",
      "syncType": "bidirectional",
      "status": "completed",
      "createdAt": "2025-01-20T15:45:00Z",
      "duration": 5847,
      "recordsExported": 8,
      "recordsImported": 5,
      "recordsUpdated": 12,
      "recordsSkipped": 2,
      "conflicts": 2
    },
    "history": [
      {
        "id": "sync-uuid-999",
        "syncType": "bidirectional",
        "status": "completed",
        "createdAt": "2025-01-20T15:45:00Z",
        "duration": 5847,
        "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        "sheetName": "Tasks"
      },
      {
        "id": "sync-uuid-888",
        "syncType": "export",
        "status": "completed",
        "createdAt": "2025-01-20T10:30:00Z",
        "duration": 2341,
        "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
        "sheetName": "Tasks"
      }
    ],
    "serviceAccountEmail": "servicebay-pm-sync@project.iam.gserviceaccount.com"
  }
}
```

**Response Fields**:

`lastSync` object (most recent sync):
- `id`: Sync log UUID
- `syncType`: "export" | "import" | "bidirectional"
- `status`: "completed" | "partial" | "failed"
- `createdAt`: Timestamp when sync started
- `duration`: Total time in milliseconds
- `recordsExported`: Tasks written to sheet
- `recordsImported`: New tasks created in DB
- `recordsUpdated`: Existing tasks updated in DB
- `recordsSkipped`: Tasks skipped
- `conflicts`: Number of conflicts encountered
- `error`: Error message (only if status is "failed")

`history` array (recent syncs):
- Contains last N sync operations (default 10, max 100)
- Ordered by `createdAt` descending (newest first)
- Same fields as `lastSync`

`serviceAccountEmail`:
- Email of configured service account
- "Not configured" if missing from environment

**Status Values**:
- `completed`: Sync finished successfully with no issues
- `partial`: Sync finished but some records had conflicts/errors
- `failed`: Sync failed completely, check error field

**Example Request**:
```bash
# Get general status
curl -X GET "http://localhost:3000/api/sync/status" \
  -H "Cookie: connect.sid=your-session-id"

# Filter by spreadsheet
curl -X GET "http://localhost:3000/api/sync/status?spreadsheetId=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" \
  -H "Cookie: connect.sid=your-session-id"

# Get more history
curl -X GET "http://localhost:3000/api/sync/status?limit=50" \
  -H "Cookie: connect.sid=your-session-id"
```

**Error Response** (validation error):
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid query parameters",
  "details": [
    {
      "code": "too_big",
      "path": ["limit"],
      "message": "Number must be less than or equal to 100"
    }
  ]
}
```

---

## Conflict Resolution Strategies

When both the database and Google Sheets have been modified since the last sync, conflicts must be resolved. The system provides three strategies with different trade-offs.

### 1. Last Writer Wins (lastWriterWins)

**Default Strategy** - Recommended for most use cases.

**Logic**:
- Compare `updatedAt` timestamps from both sources
- The version with the most recent timestamp is kept
- Automatically resolves conflicts without user intervention

**Algorithm**:
```javascript
function resolveLastWriterWins(dbTask, sheetTask) {
  // Compare timestamps
  if (sheetTask.updatedAt > dbTask.updatedAt) {
    return 'useSheet';  // Sheet is newer
  } else {
    return 'useDb';     // DB is newer or equal
  }
}
```

**Example Scenario**:

```
Timeline:
2025-01-20 10:00 - Last sync completed
2025-01-20 14:00 - Task updated in database (progress: 75%)
2025-01-20 16:00 - Same task updated in Google Sheets (progress: 80%)
2025-01-20 18:00 - Bidirectional sync triggered

Resolution:
- Conflict detected (both updated after last sync)
- Sheet updatedAt (16:00) > DB updatedAt (14:00)
- Decision: Use sheet version (progress: 80%)
- Database updated with sheet data
```

**Pros**:
- Simple and predictable
- No data loss (latest changes preserved)
- Fully automated
- Works well for sequential edits

**Cons**:
- Earlier changes may be lost
- Not ideal for simultaneous editing
- Assumes timestamp accuracy

**Use Cases**:
- Single team working in shifts
- Clear handoff between DB and sheets editing
- When timestamps are reliable
- Default option for most teams

---

### 2. Skip Conflicts (skipConflicts)

**Conservative Strategy** - Prioritizes database integrity.

**Logic**:
- If task exists in database, skip the sheet version entirely
- Only import completely new tasks from sheets
- Database is considered "source of truth"
- No updates to existing tasks during import

**Algorithm**:
```javascript
function resolveSkipConflicts(dbTask, sheetTask) {
  if (dbTask) {
    return 'skip';  // Always skip if DB has task
  } else {
    return 'useSheet';  // Import new tasks only
  }
}
```

**Example Scenario**:

```
Database State:
- Task A: exists, progress 60%
- Task B: exists, progress 40%
- Task C: does not exist

Sheet State:
- Task A: exists, progress 75% (updated)
- Task B: exists, progress 40% (no change)
- Task C: exists, new task
- Task D: exists, new task

Sync with skipConflicts:
✗ Task A: Skipped (exists in DB, even though updated in sheet)
✗ Task B: Skipped (exists in DB)
✓ Task C: Imported (new task)
✓ Task D: Imported (new task)

Result: DB has 4 tasks, only new tasks (C, D) imported
```

**Pros**:
- Database never overwritten by mistake
- Safe for critical data
- Prevents accidental data loss
- Clear separation: DB = master, Sheets = staging

**Cons**:
- Sheet edits ignored for existing tasks
- Manual intervention needed for updates
- Not truly bidirectional
- Can cause confusion

**Use Cases**:
- Initial import from external source
- When database is authoritative
- Testing sheet format before full sync
- Strict change control environments

---

### 3. Overwrite All (overwriteAll)

**Aggressive Strategy** - Sheets take precedence.

**Logic**:
- Always use sheet data, regardless of timestamps
- Ignore database modifications
- Sheet is considered "source of truth"
- Database becomes mirror of sheet

**Algorithm**:
```javascript
function resolveOverwriteAll(dbTask, sheetTask) {
  return 'useSheet';  // Always use sheet
}
```

**Example Scenario**:

```
Timeline:
2025-01-20 10:00 - Last sync completed
2025-01-20 14:00 - Task A updated in database (progress: 90%, assignee: John)
2025-01-20 16:00 - Task A updated in sheet (progress: 75%, assignee: Jane)
2025-01-20 18:00 - Sync with overwriteAll

Resolution:
- Conflict detected (both updated)
- Strategy: Always use sheet
- Decision: Use sheet version
- Database updated: progress 75%, assignee Jane
- Database changes from 14:00 are lost

⚠️ Warning: John's work (90% progress) is overwritten!
```

**Pros**:
- Simple bulk updates from sheets
- No complex conflict logic
- Fast and predictable
- Good for mass data corrections

**Cons**:
- Database changes lost
- No safety net
- Risk of data loss
- Not truly bidirectional

**Use Cases**:
- Bulk data corrections in sheets
- Initial data migration
- When sheets are definitive source
- Emergency data fixes
- One-off imports

---

### Strategy Comparison Table

| Feature | lastWriterWins | skipConflicts | overwriteAll |
|---------|----------------|---------------|--------------|
| **Safety** | Medium | High | Low |
| **Bidirectional** | Yes | No | No |
| **Auto-resolve** | Yes | No | N/A |
| **Data Loss Risk** | Low | None | High |
| **Complexity** | Medium | Low | Low |
| **Use for Production** | ✅ Yes | ⚠️ Limited | ❌ No |
| **Default** | ✅ Yes | No | No |

### Strategy Selection Flowchart

```
Are you doing initial import?
├─ Yes → Use skipConflicts (import new only)
└─ No ↓

Do you trust timestamp accuracy?
├─ No → Use overwriteAll (with caution)
└─ Yes ↓

Is database authoritative?
├─ Yes → Use skipConflicts
└─ No ↓

Is Google Sheets authoritative?
├─ Yes → Use overwriteAll
└─ No ↓

Need bidirectional sync?
└─ Yes → Use lastWriterWins (recommended)
```

### Conflict Example Walkthrough

**Setup**:
```javascript
// Database task (updated at 14:00)
{
  id: "task-123",
  taskName: "Design homepage",
  progress: 90,
  assignedToId: "user-john",
  updatedAt: new Date("2025-01-20T14:00:00Z")
}

// Sheet task (updated at 16:00)
{
  id: "task-123",
  taskName: "Design homepage - V2",
  progress: 75,
  assignedToId: "user-jane",
  updatedAt: new Date("2025-01-20T16:00:00Z")
}

// Last sync: 2025-01-20T10:00:00Z
```

**Conflict Detection**:
```javascript
const lastSync = new Date("2025-01-20T10:00:00Z");
const dbUpdated = dbTask.updatedAt > lastSync;  // true (14:00 > 10:00)
const sheetUpdated = sheetTask.updatedAt > lastSync;  // true (16:00 > 10:00)
const hasConflict = dbUpdated && sheetUpdated;  // true
```

**Resolution by Strategy**:

1. **lastWriterWins**:
   ```javascript
   sheetTask.updatedAt (16:00) > dbTask.updatedAt (14:00)
   → Use sheet version
   → Final: "Design homepage - V2", progress 75%, Jane
   ```

2. **skipConflicts**:
   ```javascript
   Task exists in DB
   → Skip sheet version
   → Final: "Design homepage", progress 90%, John (unchanged)
   ```

3. **overwriteAll**:
   ```javascript
   Always use sheet
   → Use sheet version
   → Final: "Design homepage - V2", progress 75%, Jane
   ```

---

## Data Mapping

Complete field-by-field mapping between database schema and spreadsheet format.

### Database Schema (Prisma)

```prisma
model Task {
  id             String    @id @default(uuid())
  taskName       String    @db.VarChar(200)
  details        String?   @db.Text
  progress       Int       @default(0)
  sprintId       String
  assignedToId   String
  startDate      DateTime
  deadline       DateTime
  nestingLevel   Int       @default(0)
  parentTaskId   String?
  createdById    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relations
  sprint         Sprint    @relation(fields: [sprintId], references: [id])
  assignedTo     User      @relation(fields: [assignedToId], references: [id])
  createdBy      User      @relation(fields: [createdById], references: [id])
  parentTask     Task?     @relation("TaskHierarchy", fields: [parentTaskId], references: [id])
  subtasks       Task[]    @relation("TaskHierarchy")
}
```

### Spreadsheet Column Structure

| Col | Header | Database Field | Direction | Type | Transformation |
|-----|--------|----------------|-----------|------|----------------|
| A | Task ID | id | Both | UUID | Direct copy |
| B | Task Name | taskName | Both | String | Trimmed |
| C | Details | details | Both | String? | Null → "" (export), "" → null (import) |
| D | Progress % | progress | Both | Integer | Validation 0-100 |
| E | Sprint | sprint.name | Both | String | **Lookup**: Name ↔ ID |
| F | Assigned To | assignedTo.name | Both | String | **Lookup**: Name ↔ ID |
| G | Start Date | startDate | Both | Date | **Format**: Date ↔ "YYYY-MM-DD" |
| H | Deadline | deadline | Both | Date | **Format**: Date ↔ "YYYY-MM-DD" |
| I | Nesting Level | nestingLevel | Both | Integer | Validation 0-3 |
| J | Parent ID | parentTaskId | Both | UUID? | Null → "" (export), "" → null (import) |
| K | Created At | createdAt | Both | Timestamp | **Format**: Date ↔ ISO 8601 |
| L | Updated At | updatedAt | Both | Timestamp | **Format**: Date ↔ ISO 8601 |

### Transformation Functions

#### Export: Database → Sheets

```typescript
/**
 * Transform a database task to sheet row
 */
function taskToSheetRow(task: TaskWithRelations): any[] {
  return [
    task.id,                                          // A: Task ID
    task.taskName,                                    // B: Task Name
    task.details || '',                               // C: Details (null → "")
    task.progress,                                    // D: Progress %
    task.sprint?.name || '',                          // E: Sprint (ID → name)
    task.assignedTo?.name || '',                      // F: Assigned To (ID → name)
    task.startDate ? formatDate(task.startDate) : '', // G: Start Date (Date → YYYY-MM-DD)
    task.deadline ? formatDate(task.deadline) : '',   // H: Deadline (Date → YYYY-MM-DD)
    task.nestingLevel,                                // I: Nesting Level
    task.parentTaskId || '',                          // J: Parent ID (null → "")
    task.createdAt.toISOString(),                     // K: Created At (Date → ISO)
    task.updatedAt.toISOString(),                     // L: Updated At (Date → ISO)
  ];
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

#### Import: Sheets → Database

```typescript
/**
 * Parse sheet row to task object
 */
async function sheetRowToTask(row: any[], rowIndex: number): Promise<Partial<Task>> {
  // Extract columns
  const [
    taskId,           // A
    taskName,         // B
    details,          // C
    progressStr,      // D
    sprintName,       // E
    assignedToName,   // F
    startDateStr,     // G
    deadlineStr,      // H
    nestingLevelStr,  // I
    parentIdStr,      // J
    createdAtStr,     // K
    updatedAtStr,     // L
  ] = row;

  // Validate required fields
  if (!taskId || !taskName) {
    throw new Error(`Row ${rowIndex + 1}: Missing required fields`);
  }

  // Parse and validate progress
  const progress = parseInt(progressStr) || 0;
  if (progress < 0 || progress > 100) {
    throw new Error(`Row ${rowIndex + 1}: Progress must be 0-100`);
  }

  // Parse nesting level
  const nestingLevel = parseInt(nestingLevelStr) || 0;
  if (nestingLevel < 0 || nestingLevel > 3) {
    throw new Error(`Row ${rowIndex + 1}: Nesting level must be 0-3`);
  }

  // Lookup sprint ID from name
  let sprintId: string | null = null;
  if (sprintName && sprintName.trim()) {
    const sprint = await prisma.sprint.findFirst({
      where: { name: sprintName.trim() }
    });
    if (!sprint) {
      throw new Error(`Row ${rowIndex + 1}: Sprint "${sprintName}" not found`);
    }
    sprintId = sprint.id;
  }

  // Lookup user ID from name
  let assignedToId: string | null = null;
  if (assignedToName && assignedToName.trim()) {
    const user = await prisma.user.findFirst({
      where: { name: assignedToName.trim() }
    });
    if (!user) {
      throw new Error(`Row ${rowIndex + 1}: User "${assignedToName}" not found`);
    }
    assignedToId = user.id;
  }

  // Parse dates
  const startDate = startDateStr ? parseDate(startDateStr) : null;
  const deadline = deadlineStr ? parseDate(deadlineStr) : null;
  const createdAt = createdAtStr ? parseDate(createdAtStr) : new Date();
  const updatedAt = updatedAtStr ? parseDate(updatedAtStr) : new Date();

  // Validate date order
  if (startDate && deadline && deadline < startDate) {
    throw new Error(`Row ${rowIndex + 1}: Deadline must be after start date`);
  }

  // Build task object
  return {
    id: taskId.trim(),
    taskName: taskName.trim(),
    details: details ? details.trim() : null,
    progress,
    sprintId: sprintId!,
    assignedToId: assignedToId!,
    startDate: startDate!,
    deadline: deadline!,
    nestingLevel,
    parentTaskId: parentIdStr && parentIdStr.trim() ? parentIdStr.trim() : null,
    createdAt,
    updatedAt,
  };
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  // Try ISO 8601 format
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try YYYY-MM-DD format
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map(p => parseInt(p));
    date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}
```

### Lookup Cache Optimization

For performance, the system caches sprint and user lookups:

```typescript
/**
 * Create lookup cache to avoid repeated DB queries
 */
async function createLookupCache() {
  const [sprints, users] = await Promise.all([
    prisma.sprint.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const cache = {
    sprintNameToId: new Map<string, string>(),
    sprintIdToName: new Map<string, string>(),
    userNameToId: new Map<string, string>(),
    userIdToName: new Map<string, string>(),
  };

  sprints.forEach(sprint => {
    cache.sprintNameToId.set(sprint.name, sprint.id);
    cache.sprintIdToName.set(sprint.id, sprint.name);
  });

  users.forEach(user => {
    cache.userNameToId.set(user.name, user.id);
    cache.userIdToName.set(user.id, user.name);
  });

  return cache;
}
```

**Benefits**:
- Reduces database queries from O(n) to O(1) per lookup
- Single initial query instead of query per task
- Significant performance improvement for large datasets
- Example: 1000 tasks = 1000 queries → 2 queries

---

## Security

### Authentication & Authorization

#### Service Account Security

**Service Account Credentials**:
- Private key stored in environment variable
- Never committed to version control
- Rotated regularly (recommended: every 90 days)
- Principle of least privilege (only Sheets API access)

**Environment Variable Security**:
```bash
# .env file (NEVER commit this)
GOOGLE_SERVICE_ACCOUNT_EMAIL=sync@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Store private key with \n for line breaks
# Use quotes to preserve formatting
```

**Key Rotation Process**:
```
1. Generate new service account key in Google Cloud Console
2. Download JSON credentials
3. Update .env with new credentials
4. Test sync operations
5. Delete old key in Google Cloud Console
6. Monitor for any issues
```

#### Admin-Only Access

All sync endpoints enforce admin authorization:

```typescript
// Route protection
router.post('/export-to-sheets', isAuthenticated, isAdmin, controller.exportToSheets);
router.post('/import-from-sheets', isAuthenticated, isAdmin, controller.importFromSheets);
router.post('/bidirectional', isAuthenticated, isAdmin, controller.bidirectionalSync);
router.get('/status', isAuthenticated, isAdmin, controller.getSyncStatus);
```

**Authorization Middleware**:
```typescript
/**
 * Verify user is authenticated
 */
async function isAuthenticated(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  next();
}

/**
 * Verify user has admin role
 */
async function isAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
}
```

**Why Admin-Only?**:
- Sync operations affect all tasks system-wide
- Risk of data loss with incorrect sync
- Import can create/update many tasks
- Sensitive data exposure via export
- Requires understanding of conflict resolution

### Input Validation

All inputs validated using Zod schemas before processing:

```typescript
/**
 * Export validation schema
 */
const exportToSheetsSchema = z.object({
  spreadsheetId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{44}$/, 'Invalid Google Sheets spreadsheet ID format'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  overwrite: z.boolean().default(true),
});

/**
 * Import validation schema
 */
const importFromSheetsSchema = z.object({
  spreadsheetId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{44}$/, 'Invalid Google Sheets spreadsheet ID format'),
  sheetName: z.string().min(1).max(100).trim().default('Tasks'),
  conflictStrategy: z
    .enum(['lastWriterWins', 'skipConflicts', 'overwriteAll'])
    .default('lastWriterWins'),
});
```

**Validation Benefits**:
- SQL injection prevention (parameterized queries)
- XSS prevention (input sanitization)
- Type safety (TypeScript + runtime validation)
- Clear error messages
- Early rejection of invalid requests

### Audit Logging

All sync operations are logged for security audit trail:

```typescript
// Operation start
console.log(`[Sync] Export to sheets started by ${req.user?.email}: ${data.spreadsheetId}`);

// Operation completion
console.log(`[Sync] Export completed: ${result.recordsExported} tasks exported in ${duration}ms by ${req.user?.email}`);

// Database audit log
await prisma.syncLog.create({
  data: {
    spreadsheetId: data.spreadsheetId,
    sheetName: data.sheetName,
    syncType: 'export',
    recordsExported: tasks.length,
    status: 'completed',
    duration,
    performedById: userId,
  },
});
```

**Audit Log Contents**:
- Who: User email and ID
- What: Operation type (export, import, bidirectional)
- When: Timestamp with millisecond precision
- Where: Spreadsheet ID and sheet name
- How many: Records affected counts
- Result: Status (completed, partial, failed)
- Duration: Performance metrics
- Errors: Failure details if applicable

**Audit Log Queries**:
```sql
-- Find all sync operations by user
SELECT * FROM "SyncLog"
WHERE "performedById" = 'user-uuid'
ORDER BY "createdAt" DESC;

-- Find failed sync operations
SELECT * FROM "SyncLog"
WHERE status = 'failed'
ORDER BY "createdAt" DESC;

-- Calculate sync statistics
SELECT
  syncType,
  COUNT(*) as total_syncs,
  AVG(duration) as avg_duration_ms,
  SUM(recordsExported) as total_exported,
  SUM(recordsImported) as total_imported
FROM "SyncLog"
WHERE status = 'completed'
GROUP BY syncType;
```

### Data Validation

#### Sheet Data Validation

```typescript
/**
 * Validate sheet headers match expected structure
 */
function validateHeaders(headers: any[]): boolean {
  const expected = [
    'Task ID', 'Task Name', 'Details', 'Progress %',
    'Sprint', 'Assigned To', 'Start Date', 'Deadline',
    'Nesting Level', 'Parent ID', 'Created At', 'Updated At'
  ];

  if (!headers || headers.length !== expected.length) {
    return false;
  }

  return expected.every((header, index) => headers[index] === header);
}

/**
 * Validate task data before import
 */
function validateTaskData(task: Partial<Task>): void {
  // Required fields
  if (!task.id || !task.taskName) {
    throw new Error('Task ID and Task Name are required');
  }

  // Progress validation
  if (task.progress !== undefined && (task.progress < 0 || task.progress > 100)) {
    throw new Error('Progress must be between 0 and 100');
  }

  // Nesting level validation
  if (task.nestingLevel !== undefined && (task.nestingLevel < 0 || task.nestingLevel > 3)) {
    throw new Error('Nesting level must be between 0 and 3');
  }

  // Required relations
  if (!task.sprintId) {
    throw new Error('Sprint ID is required');
  }

  if (!task.assignedToId) {
    throw new Error('Assigned To ID is required');
  }

  // Date validation
  if (!task.startDate || !task.deadline) {
    throw new Error('Start Date and Deadline are required');
  }

  if (task.startDate && task.deadline && task.deadline < task.startDate) {
    throw new Error('Deadline must be after start date');
  }
}
```

### Rate Limiting

Sync endpoints are protected by rate limiting:

```typescript
import rateLimit from 'express-rate-limit';

const syncRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 requests per window
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Too many sync requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to sync routes
router.use('/sync', syncRateLimiter);
```

**Google Sheets API Limits**:
- Read: 300 requests per minute per user
- Write: 300 requests per minute per user
- Batch operations count as single request
- Quota exceeded: Returns 429 error with retry-after header

---

## Frontend Integration

### TypeScript API Client

```typescript
/**
 * Google Sheets Sync API Client
 */
class SyncAPI {
  private baseUrl = '/api/sync';

  /**
   * Export tasks to Google Sheets
   */
  async exportToSheets(data: {
    spreadsheetId: string;
    sheetName?: string;
    overwrite?: boolean;
  }) {
    const response = await fetch(`${this.baseUrl}/export-to-sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Export failed');
    }

    return response.json();
  }

  /**
   * Import tasks from Google Sheets
   */
  async importFromSheets(data: {
    spreadsheetId: string;
    sheetName?: string;
    conflictStrategy?: 'lastWriterWins' | 'skipConflicts' | 'overwriteAll';
  }) {
    const response = await fetch(`${this.baseUrl}/import-from-sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Import failed');
    }

    return response.json();
  }

  /**
   * Perform bidirectional sync
   */
  async bidirectionalSync(data: {
    spreadsheetId: string;
    sheetName?: string;
    conflictStrategy?: 'lastWriterWins' | 'skipConflicts' | 'overwriteAll';
  }) {
    const response = await fetch(`${this.baseUrl}/bidirectional`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sync failed');
    }

    return response.json();
  }

  /**
   * Get sync status and history
   */
  async getSyncStatus(params?: {
    spreadsheetId?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    const url = query ? `${this.baseUrl}/status?${query}` : `${this.baseUrl}/status`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get status');
    }

    return response.json();
  }
}

export const syncAPI = new SyncAPI();
```

### React Component Examples

#### Sync Dashboard Component

```typescript
import React, { useState, useEffect } from 'react';
import { syncAPI } from './api/sync';

interface SyncDashboardProps {
  defaultSpreadsheetId: string;
}

export function SyncDashboard({ defaultSpreadsheetId }: SyncDashboardProps) {
  const [spreadsheetId, setSpreadsheetId] = useState(defaultSpreadsheetId);
  const [sheetName, setSheetName] = useState('Tasks');
  const [conflictStrategy, setConflictStrategy] = useState<'lastWriterWins' | 'skipConflicts' | 'overwriteAll'>('lastWriterWins');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load sync status on mount
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const result = await syncAPI.getSyncStatus({ limit: 5 });
      setStatus(result.data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await syncAPI.exportToSheets({
        spreadsheetId,
        sheetName,
        overwrite: true,
      });

      alert(`Export successful! ${result.data.recordsExported} tasks exported.`);
      await loadSyncStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await syncAPI.importFromSheets({
        spreadsheetId,
        sheetName,
        conflictStrategy,
      });

      const { recordsImported, recordsUpdated, conflicts } = result.data;
      alert(
        `Import successful!\n` +
        `${recordsImported} tasks imported\n` +
        `${recordsUpdated} tasks updated\n` +
        `${conflicts.length} conflicts`
      );

      await loadSyncStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBidirectionalSync = async () => {
    if (!confirm('Perform bidirectional sync? This will merge changes from both sources.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await syncAPI.bidirectionalSync({
        spreadsheetId,
        sheetName,
        conflictStrategy,
      });

      const { recordsExported, recordsImported, recordsUpdated, conflicts } = result.data;
      alert(
        `Sync successful!\n` +
        `Exported: ${recordsExported}\n` +
        `Imported: ${recordsImported}\n` +
        `Updated: ${recordsUpdated}\n` +
        `Conflicts: ${conflicts.length}`
      );

      await loadSyncStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sync-dashboard">
      <h2>Google Sheets Sync</h2>

      {/* Configuration Form */}
      <div className="sync-config">
        <div className="form-group">
          <label>Spreadsheet ID:</label>
          <input
            type="text"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            disabled={loading}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
          />
        </div>

        <div className="form-group">
          <label>Sheet Name:</label>
          <input
            type="text"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Conflict Strategy:</label>
          <select
            value={conflictStrategy}
            onChange={(e) => setConflictStrategy(e.target.value as any)}
            disabled={loading}
          >
            <option value="lastWriterWins">Last Writer Wins</option>
            <option value="skipConflicts">Skip Conflicts</option>
            <option value="overwriteAll">Overwrite All</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="sync-actions">
        <button
          onClick={handleExport}
          disabled={loading || !spreadsheetId}
          className="btn btn-primary"
        >
          {loading ? 'Exporting...' : 'Export to Sheets'}
        </button>

        <button
          onClick={handleImport}
          disabled={loading || !spreadsheetId}
          className="btn btn-secondary"
        >
          {loading ? 'Importing...' : 'Import from Sheets'}
        </button>

        <button
          onClick={handleBidirectionalSync}
          disabled={loading || !spreadsheetId}
          className="btn btn-warning"
        >
          {loading ? 'Syncing...' : 'Bidirectional Sync'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Sync Status */}
      {status && (
        <div className="sync-status">
          <h3>Sync Status</h3>

          {status.lastSync ? (
            <div className="last-sync">
              <p><strong>Last Sync:</strong> {new Date(status.lastSync.createdAt).toLocaleString()}</p>
              <p><strong>Type:</strong> {status.lastSync.syncType}</p>
              <p><strong>Status:</strong> {status.lastSync.status}</p>
              <p><strong>Duration:</strong> {status.lastSync.duration}ms</p>
              <p><strong>Records Exported:</strong> {status.lastSync.recordsExported}</p>
              <p><strong>Records Imported:</strong> {status.lastSync.recordsImported}</p>
              <p><strong>Records Updated:</strong> {status.lastSync.recordsUpdated}</p>
              <p><strong>Conflicts:</strong> {status.lastSync.conflicts}</p>
            </div>
          ) : (
            <p>No sync history</p>
          )}

          <h4>Recent History</h4>
          <table className="sync-history">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {status.history.map((sync: any) => (
                <tr key={sync.id}>
                  <td>{new Date(sync.createdAt).toLocaleString()}</td>
                  <td>{sync.syncType}</td>
                  <td>{sync.status}</td>
                  <td>{sync.duration}ms</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="service-account">
            <strong>Service Account:</strong> {status.serviceAccountEmail}
          </p>
        </div>
      )}
    </div>
  );
}
```

#### Sync Button Component (Simple)

```typescript
import React, { useState } from 'react';
import { syncAPI } from './api/sync';

interface SyncButtonProps {
  spreadsheetId: string;
  type: 'export' | 'import' | 'bidirectional';
  onSuccess?: () => void;
}

export function SyncButton({ spreadsheetId, type, onSuccess }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);

    try {
      let result;

      switch (type) {
        case 'export':
          result = await syncAPI.exportToSheets({ spreadsheetId });
          break;
        case 'import':
          result = await syncAPI.importFromSheets({ spreadsheetId });
          break;
        case 'bidirectional':
          result = await syncAPI.bidirectionalSync({ spreadsheetId });
          break;
      }

      alert(`${type} successful!`);
      onSuccess?.();
    } catch (error: any) {
      alert(`${type} failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className={`sync-btn sync-btn-${type}`}
    >
      {loading ? `${type}ing...` : `${type} to Sheets`}
    </button>
  );
}
```

---

## Common Workflows

### Workflow 1: Export Tasks (Database → Sheets)

**Scenario**: Share current tasks with external stakeholders via Google Sheets.

**Steps**:

1. **Prepare Spreadsheet**:
   ```
   - Create new Google Sheet or open existing one
   - Copy spreadsheet ID from URL
   - Share with service account email (Editor permission)
   ```

2. **Trigger Export**:
   ```bash
   curl -X POST "http://localhost:3000/api/sync/export-to-sheets" \
     -H "Cookie: connect.sid=your-session" \
     -H "Content-Type: application/json" \
     -d '{
       "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
       "sheetName": "Tasks",
       "overwrite": true
     }'
   ```

3. **Verify Results**:
   ```
   - Open spreadsheet in browser
   - Check headers are bold and frozen
   - Verify task count matches database
   - Check data accuracy (sample tasks)
   ```

4. **Share with Stakeholders**:
   ```
   - Click "Share" in Google Sheets
   - Add stakeholder emails
   - Set permission to "Viewer" (read-only)
   - Send link
   ```

**Expected Outcome**:
- All tasks exported to sheet
- Headers formatted (bold, frozen)
- Data matches database exactly
- Stakeholders can view but not edit

**Troubleshooting**:
- If export fails with 403: Verify service account has Editor access
- If data missing: Check database has tasks
- If formatting wrong: Re-run export with overwrite=true

---

### Workflow 2: Import Tasks (Sheets → Database)

**Scenario**: Bulk import tasks created offline in Google Sheets.

**Steps**:

1. **Prepare Sheet Data**:
   ```
   - Ensure headers match exactly (Task ID, Task Name, etc.)
   - Validate all required fields filled
   - Use existing Sprint names (case-sensitive)
   - Use existing User names (case-sensitive)
   - Generate valid UUIDs for Task IDs
   ```

2. **Choose Conflict Strategy**:
   ```
   - skipConflicts: Safe for initial import (only new tasks)
   - lastWriterWins: Update existing tasks if sheet is newer
   - overwriteAll: Force overwrite (use with caution)
   ```

3. **Trigger Import**:
   ```bash
   curl -X POST "http://localhost:3000/api/sync/import-from-sheets" \
     -H "Cookie: connect.sid=your-session" \
     -H "Content-Type: application/json" \
     -d '{
       "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
       "sheetName": "Tasks",
       "conflictStrategy": "skipConflicts"
     }'
   ```

4. **Review Results**:
   ```json
   {
     "recordsImported": 25,
     "recordsUpdated": 0,
     "conflicts": [
       {
         "taskId": "existing-task-123",
         "taskName": "Duplicate task",
         "resolution": "skip",
         "reason": "Task already exists"
       }
     ]
   }
   ```

5. **Verify in Database**:
   ```sql
   SELECT COUNT(*) FROM tasks WHERE "createdAt" > NOW() - INTERVAL '5 minutes';
   ```

**Expected Outcome**:
- New tasks created in database
- Existing tasks handled per strategy
- Conflicts reported clearly
- Data integrity maintained

**Common Issues**:
- Sprint not found: Ensure sprint name matches exactly
- User not found: Ensure user name matches exactly
- Invalid UUID: Generate proper UUID v4 format
- Date order error: Deadline must be after Start Date

---

### Workflow 3: Bidirectional Sync

**Scenario**: Regular sync to keep database and sheets in sync.

**Steps**:

1. **Initial State**:
   ```
   - Database: 100 tasks, last modified 10:00 AM
   - Sheets: 98 tasks, last modified 9:00 AM
   - Last sync: Yesterday 5:00 PM
   ```

2. **Changes Since Last Sync**:
   ```
   Database changes (since 5:00 PM yesterday):
   - 3 tasks created
   - 5 tasks updated
   - 2 tasks deleted

   Sheet changes (since 5:00 PM yesterday):
   - 2 tasks created
   - 3 tasks updated (different tasks than DB)
   - 1 task updated (same as DB) → CONFLICT
   ```

3. **Configure Strategy**:
   ```javascript
   // lastWriterWins: Compare timestamps, keep newest
   {
     "conflictStrategy": "lastWriterWins"
   }
   ```

4. **Execute Sync**:
   ```bash
   curl -X POST "http://localhost:3000/api/sync/bidirectional" \
     -H "Cookie: connect.sid=your-session" \
     -H "Content-Type: application/json" \
     -d '{
       "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
       "sheetName": "Tasks",
       "conflictStrategy": "lastWriterWins"
     }'
   ```

5. **Sync Process**:
   ```
   Phase 1: Analyze Changes
   - DB-only: 3 new + 4 updated (not in sheet) = 7 changes
   - Sheet-only: 2 new + 2 updated (not in DB) = 4 changes
   - Conflicts: 1 task updated in both

   Phase 2: Apply Resolution
   - Conflict task: Compare timestamps
     - DB updated: 10:00 AM
     - Sheet updated: 11:00 AM
     - Decision: Use sheet (newer)

   Phase 3: Execute Updates
   - Update DB with sheet changes: 2 new + 3 updated
   - Update sheet with DB changes: 3 new + 4 updated

   Phase 4: Final Refresh
   - Export all tasks to sheet (full refresh)
   - Both sources now consistent
   ```

6. **Review Results**:
   ```json
   {
     "recordsExported": 7,
     "recordsImported": 2,
     "recordsUpdated": 3,
     "conflicts": [
       {
         "taskId": "task-conflict-123",
         "taskName": "Update documentation",
         "resolution": "useSheet",
         "reason": "Sheet updated at 11:00 AM, DB at 10:00 AM"
       }
     ]
   }
   ```

**Expected Outcome**:
- All changes merged successfully
- Conflicts resolved per strategy
- Both sources synchronized
- No data loss

**Schedule Recommendation**:
- Manual trigger after bulk edits
- Weekly sync for active projects
- Daily sync for high-change environments
- After significant offline work

---

## Troubleshooting

### Issue: "Spreadsheet not found"

**HTTP Status**: 404

**Error Message**:
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Spreadsheet not found"
}
```

**Causes**:
1. Invalid spreadsheet ID
2. Spreadsheet deleted
3. Spreadsheet moved to different account
4. Typo in spreadsheet ID

**Solutions**:

1. **Verify Spreadsheet ID**:
   ```
   URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
                                                       ↑ This is the spreadsheet ID (44 characters)
   ```

2. **Test Access Manually**:
   ```
   - Open spreadsheet URL in browser
   - Ensure it loads successfully
   - Check you have access
   ```

3. **Verify Not Deleted**:
   ```
   - Check Google Drive trash
   - Contact spreadsheet owner
   ```

**Prevention**:
- Store spreadsheet ID in config
- Validate ID format before sync
- Test with known-good ID first

---

### Issue: "Access denied. Please share the spreadsheet with the service account email."

**HTTP Status**: 403

**Error Message**:
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Access denied. Please share the spreadsheet with the service account email."
}
```

**Cause**: Service account does not have permission to access spreadsheet.

**Solutions**:

1. **Share Spreadsheet**:
   ```
   1. Open spreadsheet in browser
   2. Click "Share" button (top right)
   3. Enter service account email:
      servicebay-pm-sync@your-project.iam.gserviceaccount.com
   4. Set permission to "Editor"
   5. Uncheck "Notify people"
   6. Click "Share"
   ```

2. **Verify Service Account Email**:
   ```bash
   # Check configured email
   echo $GOOGLE_SERVICE_ACCOUNT_EMAIL

   # Should match email in Google Cloud Console
   ```

3. **Check Spreadsheet Permissions**:
   ```
   1. Open spreadsheet
   2. Click "Share"
   3. Look for service account in list
   4. Ensure role is "Editor" (not "Viewer")
   ```

**Prevention**:
- Share all sheets with service account upfront
- Document service account email in setup docs
- Create template spreadsheet pre-shared
- Use Google Drive API to auto-share (advanced)

---

### Issue: "Invalid sheet format" or "Invalid sheet headers"

**HTTP Status**: 400

**Error Message**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid sheet headers. Please ensure the sheet has the correct column structure."
}
```

**Cause**: Sheet headers don't match expected structure.

**Expected Headers** (exact match required):
```
Task ID | Task Name | Details | Progress % | Sprint | Assigned To | Start Date | Deadline | Nesting Level | Parent ID | Created At | Updated At
```

**Solutions**:

1. **Verify Headers**:
   ```
   Row 1 must contain exactly these headers in this order:
   - Task ID (column A)
   - Task Name (column B)
   - Details (column C)
   - Progress % (column D)
   - Sprint (column E)
   - Assigned To (column F)
   - Start Date (column G)
   - Deadline (column H)
   - Nesting Level (column I)
   - Parent ID (column J)
   - Created At (column K)
   - Updated At (column L)
   ```

2. **Fix Headers**:
   ```
   - Ensure exact spelling (case-sensitive)
   - No extra spaces
   - No special characters
   - No missing columns
   - No extra columns before these
   ```

3. **Use Template**:
   ```
   - Export empty sheet first (creates correct headers)
   - Copy headers to your sheet
   - Fill in data below headers
   ```

**Prevention**:
- Always start with export to get correct format
- Create template sheet for team
- Document header requirements
- Add validation to frontend

---

### Issue: "Sprint '[name]' not found" or "User '[name]' not found"

**HTTP Status**: 400 (during import processing)

**Error Message**:
```json
{
  "conflicts": [
    {
      "taskId": "task-123",
      "taskName": "Fix bug",
      "resolution": "skip",
      "reason": "Processing failed: Sprint \"Sprint 2\" not found"
    }
  ]
}
```

**Cause**: Sprint or user name in sheet doesn't match database exactly.

**Solutions**:

1. **Check Sprint Names**:
   ```sql
   -- Get all sprint names
   SELECT id, name FROM sprints ORDER BY name;
   ```

2. **Check User Names**:
   ```sql
   -- Get all user names
   SELECT id, name, email FROM users ORDER BY name;
   ```

3. **Fix Sheet Data**:
   ```
   - Ensure exact name match (case-sensitive)
   - Check for extra spaces
   - Verify spelling
   - Use autocomplete if available
   ```

4. **Create Missing Entities**:
   ```sql
   -- Create missing sprint
   INSERT INTO sprints (id, name, "startDate", "endDate", "createdById")
   VALUES (uuid_generate_v4(), 'Sprint 2', '2025-02-01', '2025-02-14', 'admin-uuid');

   -- Or create via API
   ```

**Prevention**:
- Export before import to get current names
- Use dropdown validation in sheets
- Document naming conventions
- Sync entity names regularly

---

### Issue: "Progress must be between 0 and 100" or "Nesting level must be between 0 and 3"

**HTTP Status**: Included in import results (not error)

**Validation Errors**: Individual task processing failures.

**Cause**: Data doesn't meet validation constraints.

**Validation Rules**:
```
Progress:
- Type: Integer
- Range: 0-100 (inclusive)
- Examples: 0, 50, 100 ✓ | -10, 150, 75.5 ✗

Nesting Level:
- Type: Integer
- Range: 0-3 (inclusive)
- 0 = Top-level task
- 1 = Subtask
- 2 = Sub-subtask
- 3 = Detail level (max depth)
- Examples: 0, 1, 2, 3 ✓ | -1, 4, 5 ✗
```

**Solutions**:

1. **Fix Data in Sheet**:
   ```
   - Ensure progress is 0-100
   - Ensure nesting level is 0-3
   - Remove decimal points from integers
   - Check for negative values
   ```

2. **Use Sheet Validation**:
   ```
   Google Sheets Data Validation:
   1. Select Progress column (D)
   2. Data → Data validation
   3. Criteria: Number between 0 and 100
   4. Show warning or reject input

   Repeat for Nesting Level (0-3)
   ```

3. **Bulk Fix Formula**:
   ```
   Progress fix (cap at 0-100):
   =MAX(0, MIN(100, D2))

   Nesting level fix (cap at 0-3):
   =MAX(0, MIN(3, I2))
   ```

**Prevention**:
- Add data validation in sheets
- Provide value ranges in docs
- Use dropdown for nesting level
- Implement client-side validation

---

### Issue: "Deadline must be after start date"

**HTTP Status**: Included in import results

**Error Message**: Task-level validation error.

**Cause**: Deadline date is before or equal to start date.

**Solutions**:

1. **Check Date Order**:
   ```
   Invalid:
   Start Date: 2025-01-20
   Deadline:   2025-01-15  ✗ (before start)

   Valid:
   Start Date: 2025-01-15
   Deadline:   2025-01-20  ✓ (after start)
   ```

2. **Fix in Sheet**:
   ```
   - Ensure Deadline (column H) > Start Date (column G)
   - Check for typos
   - Verify year, month, day
   ```

3. **Use Conditional Formatting**:
   ```
   Google Sheets Conditional Formatting:
   1. Select Deadline column (H)
   2. Format → Conditional formatting
   3. Format cells if: Custom formula is
   4. Formula: =H2<=G2
   5. Formatting style: Red background
   6. Highlights invalid dates
   ```

**Prevention**:
- Add data validation rule
- Use formula-based warnings
- Document date requirements
- Validate before sync

---

### Issue: Rate limit exceeded

**HTTP Status**: 429

**Error Message**:
```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Too many sync requests. Please try again later."
}
```

**Causes**:
1. Too many sync operations in short time
2. Application rate limit (10 requests per 15 minutes)
3. Google Sheets API quota exceeded

**Solutions**:

1. **Wait and Retry**:
   ```
   - Wait 15 minutes
   - Retry sync operation
   ```

2. **Reduce Sync Frequency**:
   ```
   - Batch changes before sync
   - Schedule syncs (e.g., hourly instead of per-change)
   - Use bidirectional sync instead of separate import/export
   ```

3. **Check Google API Quotas**:
   ```
   Google Cloud Console:
   1. APIs & Services → Dashboard
   2. Select "Google Sheets API"
   3. View quota usage
   4. Request quota increase if needed
   ```

**Prevention**:
- Implement client-side throttling
- Cache sync status (refresh every 5 minutes)
- Use debouncing on sync buttons
- Schedule syncs during off-hours

---

### Issue: "Configuration Error: Google Sheets API is not properly configured"

**HTTP Status**: 500

**Error Message**:
```json
{
  "success": false,
  "error": "Configuration Error",
  "message": "Google Sheets API is not properly configured. Please check service account credentials."
}
```

**Cause**: Missing or invalid service account configuration.

**Solutions**:

1. **Check Environment Variables**:
   ```bash
   # Verify variables are set
   printenv | grep GOOGLE_SERVICE_ACCOUNT

   # Should show:
   # GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   # GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
   ```

2. **Verify Credentials Format**:
   ```bash
   # Private key should have line breaks
   echo "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY" | head -n 1
   # Expected: -----BEGIN PRIVATE KEY-----

   # Email should be valid service account format
   echo "$GOOGLE_SERVICE_ACCOUNT_EMAIL"
   # Expected: name@project.iam.gserviceaccount.com
   ```

3. **Reload Environment**:
   ```bash
   # Restart application to reload .env
   npm run dev
   # or
   pm2 restart app
   ```

4. **Test Configuration**:
   ```bash
   # Test with status endpoint (doesn't require spreadsheet)
   curl -X GET "http://localhost:3000/api/sync/status" \
     -H "Cookie: connect.sid=your-session"

   # Check serviceAccountEmail in response
   ```

**Prevention**:
- Validate env vars on application startup
- Add health check endpoint
- Document setup process
- Use .env.example template

---

### Issue: Sync takes too long or times out

**Symptom**: Sync operation exceeds 2 minutes (default timeout).

**Causes**:
1. Large dataset (1000+ tasks)
2. Network latency
3. Google Sheets API slow response
4. Database query performance

**Solutions**:

1. **Optimize Batch Size**:
   ```typescript
   // Process in smaller batches
   const BATCH_SIZE = 100;
   for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
     const batch = tasks.slice(i, i + BATCH_SIZE);
     await processBatch(batch);
   }
   ```

2. **Use Batch Operations**:
   ```typescript
   // Batch write instead of individual writes
   await sheets.spreadsheets.values.batchUpdate({
     spreadsheetId,
     requestBody: {
       valueInputOption: 'RAW',
       data: [
         { range: 'Tasks!A1:L1000', values: allTaskData }
       ]
     }
   });
   ```

3. **Increase Timeout**:
   ```typescript
   // In controller
   const timeout = 5 * 60 * 1000; // 5 minutes
   const timeoutPromise = new Promise((_, reject) =>
     setTimeout(() => reject(new Error('Sync timeout')), timeout)
   );

   await Promise.race([
     syncService.bidirectionalSync(...),
     timeoutPromise
   ]);
   ```

4. **Add Progress Tracking**:
   ```typescript
   // Emit progress events
   syncService.on('progress', (percent) => {
     console.log(`Sync progress: ${percent}%`);
   });
   ```

**Prevention**:
- Monitor sync duration
- Set reasonable timeout
- Implement pagination for large datasets
- Use background jobs for big syncs

---

## Best Practices

### 1. When to Use Each Sync Type

**Export (Database → Sheets)**:

Use when:
- Sharing data with external stakeholders
- Creating reports or backups
- Initial sheet setup
- After major database changes
- For read-only access

Don't use when:
- Sheet has been edited (data loss)
- Need to merge changes
- Frequent bi-directional updates needed

**Import (Sheets → Database)**:

Use when:
- Bulk creating tasks from external source
- Offline work completed in sheets
- Manual data entry in sheets
- One-time data migration
- Team prefers spreadsheet input

Don't use when:
- Database has recent updates (conflicts)
- Sheet data quality uncertain
- Need to preserve database changes

**Bidirectional Sync**:

Use when:
- Regular ongoing sync needed
- Both sources actively used
- Changes occur in both places
- Need conflict detection
- Production environment

Don't use when:
- First-time setup (use export)
- One-way flow sufficient
- High conflict risk

### 2. Conflict Strategy Selection

**Scenario-Based Recommendations**:

```
Scenario: Initial import from spreadsheet
✅ Use: skipConflicts
Why: Prevents overwriting existing tasks, safe for first import

Scenario: Team works in shifts (DB during day, Sheets at night)
✅ Use: lastWriterWins
Why: Clear time separation, newest changes always win

Scenario: Sheets is authoritative source (e.g., PM managed)
✅ Use: overwriteAll
Why: Sheets defines truth, DB is mirror

Scenario: Database is authoritative (Sheets for viewing only)
✅ Use: export only (don't import)
Why: Prevents accidental overwrites

Scenario: Both sources actively edited simultaneously
⚠️ Difficult: lastWriterWins with frequent syncs
Consider: Manual review, redesign workflow
```

### 3. Data Quality Checks

**Before Export**:
```typescript
// Verify data completeness
const checks = await prisma.$transaction([
  prisma.task.count({ where: { taskName: null } }),
  prisma.task.count({ where: { progress: { lt: 0 } } }),
  prisma.task.count({ where: { progress: { gt: 100 } } }),
  prisma.task.count({ where: { sprintId: null } }),
  prisma.task.count({ where: { assignedToId: null } }),
]);

if (checks.some(count => count > 0)) {
  console.warn('Data quality issues detected before export');
}
```

**Before Import**:
```typescript
// Validate sheet structure
function validateSheetData(rows: any[][]): string[] {
  const errors: string[] = [];

  // Check row count
  if (rows.length < 2) {
    errors.push('Sheet must have at least header + 1 data row');
  }

  // Check each row
  rows.slice(1).forEach((row, index) => {
    const rowNum = index + 2;

    if (!row[0]) errors.push(`Row ${rowNum}: Missing Task ID`);
    if (!row[1]) errors.push(`Row ${rowNum}: Missing Task Name`);
    if (row[3] < 0 || row[3] > 100) errors.push(`Row ${rowNum}: Invalid progress`);
  });

  return errors;
}
```

### 4. Monitoring and Alerting

**Key Metrics to Track**:

```typescript
interface SyncMetrics {
  // Performance
  averageDuration: number;
  maxDuration: number;
  successRate: number;

  // Volume
  totalSyncs: number;
  totalRecordsExported: number;
  totalRecordsImported: number;

  // Quality
  conflictRate: number;
  errorRate: number;
  failedSyncs: number;
}

// Calculate metrics
async function getSyncMetrics(since: Date): Promise<SyncMetrics> {
  const logs = await prisma.syncLog.findMany({
    where: { createdAt: { gte: since } }
  });

  return {
    averageDuration: avg(logs.map(l => l.duration)),
    maxDuration: max(logs.map(l => l.duration)),
    successRate: logs.filter(l => l.status === 'completed').length / logs.length,
    totalSyncs: logs.length,
    totalRecordsExported: sum(logs.map(l => l.recordsExported)),
    totalRecordsImported: sum(logs.map(l => l.recordsImported)),
    conflictRate: sum(logs.map(l => l.conflicts)) / sum(logs.map(l => l.recordsImported)),
    errorRate: logs.filter(l => l.status === 'failed').length / logs.length,
    failedSyncs: logs.filter(l => l.status === 'failed').length,
  };
}
```

**Alert Thresholds**:
- Sync duration > 30 seconds: Warning
- Sync duration > 60 seconds: Critical
- Conflict rate > 10%: Investigate workflow
- Error rate > 5%: Check configuration
- Failed syncs > 3 in 1 hour: Alert admin

### 5. Security Checklist

**Pre-Production**:
- [ ] Service account private key in environment variable (not code)
- [ ] Private key not committed to version control
- [ ] .env file in .gitignore
- [ ] Service account has minimal permissions (Sheets API only)
- [ ] Admin-only access enforced on all endpoints
- [ ] Rate limiting configured and tested
- [ ] Input validation comprehensive
- [ ] Audit logging implemented
- [ ] Error messages don't leak sensitive data

**Regular Maintenance**:
- [ ] Rotate service account key every 90 days
- [ ] Review audit logs monthly
- [ ] Check for unauthorized access attempts
- [ ] Verify spreadsheet sharing list
- [ ] Update dependencies for security patches

### 6. Testing Best Practices

**Test Data Setup**:
```typescript
// Create test environment
async function setupTestEnvironment() {
  // Create test spreadsheet
  const testSpreadsheet = await createTestSpreadsheet();

  // Seed test data
  await prisma.task.createMany({
    data: [
      {
        id: uuid(),
        taskName: 'Test Task 1',
        progress: 50,
        sprintId: 'test-sprint',
        assignedToId: 'test-user',
        startDate: new Date(),
        deadline: new Date(Date.now() + 86400000),
        nestingLevel: 0,
        createdById: 'test-admin',
      },
      // ... more test tasks
    ]
  });

  return { testSpreadsheet };
}

// Test scenarios
describe('Sync Integration Tests', () => {
  it('should export all tasks', async () => {
    const result = await syncAPI.exportToSheets({
      spreadsheetId: testSpreadsheet.id
    });

    expect(result.success).toBe(true);
    expect(result.data.recordsExported).toBeGreaterThan(0);
  });

  it('should handle conflicts with lastWriterWins', async () => {
    // Setup conflict scenario
    // ... test implementation
  });
});
```

**Mock Testing**:
```typescript
// Mock Google Sheets API for unit tests
jest.mock('./client', () => ({
  getGoogleSheetsClient: () => ({
    verifyAccess: jest.fn().mockResolvedValue(true),
    readSheet: jest.fn().mockResolvedValue([
      ['Task ID', 'Task Name', /* ... */],
      ['test-id', 'Test Task', /* ... */],
    ]),
    writeSheet: jest.fn().mockResolvedValue(undefined),
  }),
}));
```

### 7. Documentation for Users

**User Guide Template**:

```markdown
# Google Sheets Sync - User Guide

## Quick Start

1. Get spreadsheet ID from URL
2. Share sheet with: servicebay-pm-sync@project.iam.gserviceaccount.com
3. Click sync button in admin panel
4. Check results

## Common Tasks

### Export for Reporting
1. Click "Export to Sheets"
2. Choose spreadsheet
3. Select "Overwrite existing data"
4. Share with stakeholders

### Bulk Update Tasks
1. Export current data first
2. Edit in Google Sheets
3. Click "Import from Sheets"
4. Review conflicts
5. Verify changes in app

## Troubleshooting

Q: Sync fails with "Access denied"
A: Share spreadsheet with service account email

Q: Some tasks not imported
A: Check conflict strategy and review error details

[More FAQs...]
```

---

## Performance Considerations

### 1. Batch Operations

Google Sheets API performance comparison:

```typescript
// ❌ Bad: Individual cell updates (very slow)
for (const task of tasks) {
  await sheets.spreadsheets.values.update({
    range: `Tasks!A${rowIndex}`,
    values: [[task.id]]
  });
  await sheets.spreadsheets.values.update({
    range: `Tasks!B${rowIndex}`,
    values: [[task.taskName]]
  });
  // ... 12 API calls per task
}
// Result: 1000 tasks = 12,000 API calls = ~5 minutes

// ✅ Good: Batch update (fast)
const allData = tasks.map(taskToSheetRow);
await sheets.spreadsheets.values.update({
  range: 'Tasks!A2:L1001',
  values: allData
});
// Result: 1000 tasks = 1 API call = ~2 seconds
```

**Performance Gains**:
- Batch operations: 150x faster
- Reduced network overhead
- Lower API quota usage
- Better reliability

### 2. Database Query Optimization

**Inefficient**:
```typescript
// ❌ Bad: N+1 query problem
const tasks = await prisma.task.findMany();
for (const task of tasks) {
  const sprint = await prisma.sprint.findUnique({ where: { id: task.sprintId } });
  const user = await prisma.user.findUnique({ where: { id: task.assignedToId } });
  // Process task with relations
}
// Result: 1 + (2 * N) queries = 2001 queries for 1000 tasks
```

**Optimized**:
```typescript
// ✅ Good: Include relations in single query
const tasks = await prisma.task.findMany({
  include: {
    sprint: true,
    assignedTo: true,
  }
});
// Result: 1 query with joins
```

**Performance Gain**: 2000x fewer database queries

### 3. Caching Strategies

**Lookup Cache**:
```typescript
// Cache sprint and user lookups
const cache = await createLookupCache();

// Use cache instead of DB queries
function resolveSprintId(name: string): string | null {
  return cache.sprintNameToId.get(name) || null;
}

// Performance: O(1) instead of O(n) per lookup
```

**Results Cache**:
```typescript
// Cache sync status for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
let cachedStatus: { data: any; timestamp: number } | null = null;

async function getSyncStatus(userId: string) {
  const now = Date.now();

  if (cachedStatus && (now - cachedStatus.timestamp) < CACHE_TTL) {
    return cachedStatus.data;
  }

  const data = await syncService.getSyncStatus(userId);
  cachedStatus = { data, timestamp: now };
  return data;
}
```

### 4. Parallel Processing

**Sequential Processing** (slow):
```typescript
// ❌ Bad: Process tasks one by one
for (const task of sheetTasks) {
  await validateAndImport(task);
}
// Result: 1000 tasks * 50ms = 50 seconds
```

**Parallel Processing** (fast):
```typescript
// ✅ Good: Process in parallel batches
const BATCH_SIZE = 10;
for (let i = 0; i < sheetTasks.length; i += BATCH_SIZE) {
  const batch = sheetTasks.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(task => validateAndImport(task)));
}
// Result: (1000 / 10) batches * 50ms = 5 seconds
```

**Performance Gain**: 10x faster

### 5. Database Transactions

Use transactions for atomicity and performance:

```typescript
// ✅ Good: Single transaction for all updates
await prisma.$transaction(async (tx) => {
  for (const task of validTasks) {
    if (existingIds.has(task.id)) {
      await tx.task.update({ where: { id: task.id }, data: task });
    } else {
      await tx.task.create({ data: task });
    }
  }
});

// Benefits:
// - All succeed or all fail (atomicity)
// - Reduced transaction overhead
// - Better performance for bulk operations
```

### 6. Rate Limit Management

**Google Sheets API Limits**:
- Read: 300 requests/minute/user
- Write: 300 requests/minute/user
- Batch operations count as 1 request

**Implementation**:
```typescript
class RateLimiter {
  private requests: number[] = [];
  private limit = 300;
  private windowMs = 60 * 1000;

  async checkLimit(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    // Check if at limit
    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      console.log(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requests.push(now);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.checkLimit();
    return fn();
  }
}
```

### 7. Performance Benchmarks

**Typical Performance** (1000 tasks):

| Operation | Time | Notes |
|-----------|------|-------|
| Export to Sheets | 2-3 sec | Batch write, single API call |
| Import from Sheets | 8-12 sec | Includes validation + DB writes |
| Bidirectional Sync | 12-18 sec | Export + Import + conflict resolution |
| Sync Status Query | <100ms | Simple DB query with limit |

**Large Dataset** (10,000 tasks):

| Operation | Time | Notes |
|-----------|------|-------|
| Export to Sheets | 15-20 sec | Still single batch write |
| Import from Sheets | 90-120 sec | Limited by DB transaction time |
| Bidirectional Sync | 120-180 sec | May require pagination |

**Optimization Tips**:
- Use database indexes on frequently queried fields
- Implement pagination for datasets > 5000 tasks
- Consider background jobs for very large syncs
- Monitor and optimize slow queries

---

## Testing

### Unit Tests

Test individual functions in isolation:

```typescript
import { taskToSheetRow, sheetRowToTask } from '@/sync/mapper';
import { detectConflict, resolveConflict } from '@/sync/mapper';

describe('Data Mapper', () => {
  describe('taskToSheetRow', () => {
    it('should transform task to sheet row', () => {
      const task = {
        id: 'test-id',
        taskName: 'Test Task',
        details: 'Details here',
        progress: 75,
        nestingLevel: 0,
        parentTaskId: null,
        sprint: { name: 'Sprint 1' },
        assignedTo: { name: 'John Doe' },
        startDate: new Date('2025-01-15'),
        deadline: new Date('2025-01-20'),
        createdAt: new Date('2025-01-10T10:00:00Z'),
        updatedAt: new Date('2025-01-18T14:30:00Z'),
      };

      const row = taskToSheetRow(task);

      expect(row).toEqual([
        'test-id',
        'Test Task',
        'Details here',
        75,
        'Sprint 1',
        'John Doe',
        '2025-01-15',
        '2025-01-20',
        0,
        '',
        '2025-01-10T10:00:00.000Z',
        '2025-01-18T14:30:00.000Z',
      ]);
    });

    it('should handle null details', () => {
      const task = { /* ... */ details: null };
      const row = taskToSheetRow(task);
      expect(row[2]).toBe('');
    });
  });

  describe('detectConflict', () => {
    it('should detect conflict when both updated after sync', () => {
      const lastSync = new Date('2025-01-20T10:00:00Z');
      const dbTask = { updatedAt: new Date('2025-01-20T14:00:00Z') };
      const sheetTask = { updatedAt: new Date('2025-01-20T16:00:00Z') };

      const hasConflict = detectConflict(dbTask, sheetTask, lastSync);

      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict when only DB updated', () => {
      const lastSync = new Date('2025-01-20T10:00:00Z');
      const dbTask = { updatedAt: new Date('2025-01-20T14:00:00Z') };
      const sheetTask = { updatedAt: new Date('2025-01-20T09:00:00Z') };

      const hasConflict = detectConflict(dbTask, sheetTask, lastSync);

      expect(hasConflict).toBe(false);
    });
  });

  describe('resolveConflict', () => {
    it('should use sheet for lastWriterWins when sheet is newer', () => {
      const dbTask = { updatedAt: new Date('2025-01-20T14:00:00Z') };
      const sheetTask = { updatedAt: new Date('2025-01-20T16:00:00Z') };

      const resolution = resolveConflict(dbTask, sheetTask, 'lastWriterWins');

      expect(resolution).toBe('useSheet');
    });

    it('should skip for skipConflicts strategy', () => {
      const resolution = resolveConflict({}, {}, 'skipConflicts');
      expect(resolution).toBe('skip');
    });

    it('should use sheet for overwriteAll strategy', () => {
      const resolution = resolveConflict({}, {}, 'overwriteAll');
      expect(resolution).toBe('useSheet');
    });
  });
});
```

### Integration Tests

Test complete workflows:

```typescript
import request from 'supertest';
import app from '@/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Google Sheets Sync Integration', () => {
  let adminSession: string;
  let testSpreadsheetId: string;
  let testTask: any;

  beforeAll(async () => {
    // Setup test environment
    adminSession = await createAdminSession();
    testSpreadsheetId = process.env.TEST_SPREADSHEET_ID!;

    // Create test task
    testTask = await prisma.task.create({
      data: {
        taskName: 'Test Task',
        progress: 50,
        sprintId: 'test-sprint',
        assignedToId: 'test-user',
        startDate: new Date(),
        deadline: new Date(Date.now() + 86400000),
        nestingLevel: 0,
        createdById: 'test-admin',
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.task.delete({ where: { id: testTask.id } });
    await prisma.$disconnect();
  });

  describe('POST /api/sync/export-to-sheets', () => {
    it('should export tasks successfully', async () => {
      const response = await request(app)
        .post('/api/sync/export-to-sheets')
        .set('Cookie', adminSession)
        .send({
          spreadsheetId: testSpreadsheetId,
          sheetName: 'Tasks',
          overwrite: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recordsExported).toBeGreaterThan(0);
    });

    it('should require admin access', async () => {
      const response = await request(app)
        .post('/api/sync/export-to-sheets')
        .send({
          spreadsheetId: testSpreadsheetId,
        });

      expect(response.status).toBe(401);
    });

    it('should validate spreadsheet ID format', async () => {
      const response = await request(app)
        .post('/api/sync/export-to-sheets')
        .set('Cookie', adminSession)
        .send({
          spreadsheetId: 'invalid-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('POST /api/sync/import-from-sheets', () => {
    it('should import tasks with skipConflicts', async () => {
      const response = await request(app)
        .post('/api/sync/import-from-sheets')
        .set('Cookie', adminSession)
        .send({
          spreadsheetId: testSpreadsheetId,
          sheetName: 'Tasks',
          conflictStrategy: 'skipConflicts',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('recordsImported');
      expect(response.body.data).toHaveProperty('recordsUpdated');
      expect(response.body.data).toHaveProperty('conflicts');
    });
  });

  describe('POST /api/sync/bidirectional', () => {
    it('should perform bidirectional sync', async () => {
      const response = await request(app)
        .post('/api/sync/bidirectional')
        .set('Cookie', adminSession)
        .send({
          spreadsheetId: testSpreadsheetId,
          sheetName: 'Tasks',
          conflictStrategy: 'lastWriterWins',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recordsExported).toBeGreaterThanOrEqual(0);
      expect(response.body.data.recordsImported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/sync/status', () => {
    it('should return sync status', async () => {
      const response = await request(app)
        .get('/api/sync/status')
        .set('Cookie', adminSession);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lastSync');
      expect(response.body.data).toHaveProperty('history');
      expect(response.body.data).toHaveProperty('serviceAccountEmail');
    });
  });
});
```

### Manual Testing Checklist

**Pre-Deployment Testing**:

- [ ] Service account authentication works
- [ ] Spreadsheet sharing and permissions
- [ ] Export creates correct headers
- [ ] Export data accuracy
- [ ] Import validates headers
- [ ] Import handles invalid data
- [ ] Conflict detection works
- [ ] All three conflict strategies work
- [ ] Bidirectional sync merges correctly
- [ ] Sync status displays correctly
- [ ] Audit logs created
- [ ] Error handling graceful
- [ ] Rate limiting enforced
- [ ] Admin-only access enforced

**Performance Testing**:

- [ ] Export 1000 tasks < 5 seconds
- [ ] Import 1000 tasks < 15 seconds
- [ ] Bidirectional sync 1000 tasks < 20 seconds
- [ ] No memory leaks during sync
- [ ] Database connections released
- [ ] Google API quota not exceeded

---

## Related Documentation

- [Task Management API](./05-task-management.md) - Task data model and CRUD operations
- [Sprint Management API](./04-sprint-management.md) - Sprint structure and relationships
- [Authentication & Authorization](./02-authentication.md) - Admin access and security
- [Database Schema](./01-database-schema.md) - Data models and relationships
- [Google Sheets Plan](../plans/06-google-sheets-plan.md) - Implementation details and decisions

---

## Appendices

### A. Environment Variables Reference

```bash
# Required
GOOGLE_SERVICE_ACCOUNT_EMAIL=servicebay-pm-sync@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional (defaults shown)
SYNC_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
SYNC_RATE_LIMIT_MAX=10            # Max requests per window
```

### B. Database Schema

```sql
-- SyncLog table
CREATE TABLE "SyncLog" (
  "id" TEXT PRIMARY KEY,
  "spreadsheetId" TEXT NOT NULL,
  "sheetName" TEXT NOT NULL,
  "syncType" TEXT NOT NULL,
  "recordsExported" INTEGER NOT NULL DEFAULT 0,
  "recordsImported" INTEGER NOT NULL DEFAULT 0,
  "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
  "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
  "conflicts" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "duration" INTEGER NOT NULL,
  "performedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY ("performedById") REFERENCES "User"("id")
);

CREATE INDEX "SyncLog_spreadsheetId_idx" ON "SyncLog"("spreadsheetId");
CREATE INDEX "SyncLog_performedById_idx" ON "SyncLog"("performedById");
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");
```

### C. Google Sheets Spreadsheet ID Format

Google Sheets spreadsheet IDs are:
- 44 characters long
- Alphanumeric with dashes and underscores
- Found in spreadsheet URL
- Example: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

**Extract from URL**:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
                                         ↑
                                    44 characters
```

**Validation Regex**:
```regex
^[a-zA-Z0-9_-]{44}$
```

### D. Google Sheets API Quotas

**Default Quotas** (per project):
- Read requests: 300 per minute per user
- Write requests: 300 per minute per user
- Reads per day: 50,000
- Writes per day: 50,000

**Batch Operations**:
- Count as single request
- Can update multiple ranges
- Maximum 100 operations per batch

**Quota Exceeded Handling**:
```typescript
try {
  await sheetsClient.writeSheet(spreadsheetId, range, data);
} catch (error: any) {
  if (error.code === 429) {
    // Rate limit exceeded
    const retryAfter = error.response?.headers['retry-after'] || 60;
    console.log(`Rate limit exceeded, waiting ${retryAfter}s`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    // Retry operation
  }
}
```

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained by**: ServiceBay.ai Development Team
