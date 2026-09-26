# CSV Import Feature Guide

## Overview

The CSV Import feature allows administrators to bulk import tasks from CSV or Excel files. This is useful for migrating tasks from other systems or quickly creating many tasks at once.

## Access

- **Location**: Tasks page → "Import CSV" button (visible to admins only)
- **Permissions**: Admin users only
- **File types**: CSV (.csv), Excel (.xlsx, .xls)
- **Max file size**: 10MB
- **Max rows**: 10,000 tasks per file

## CSV Format

### Required Columns

1. **Task Name** (string, 1-200 characters)
2. **Progress** (integer, 0-100)
3. **Nesting Level** (integer, 0-3)
   - 0 = Root task
   - 1 = Subtask (level 1)
   - 2 = Sub-subtask (level 2)
   - 3 = Deepest level

### Optional Columns

4. **Details** (string, max 1,000 characters)
5. **Sprint** (string, must match existing sprint name)
6. **Assigned To** (email, must match existing active user)
7. **Start Date** (date, ISO 8601 or MM/DD/YYYY)
8. **Deadline** (date, ISO 8601 or MM/DD/YYYY)
9. **Parent ID** (UUID, required for nested tasks with Nesting Level > 0)

## Example CSV

```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
Setup Development Environment,Install Node.js and PostgreSQL,100,Sprint 1,dev@servicebay.ai,2025-01-01,2025-01-05,0,
Database Schema,Design and implement schema,75,Sprint 1,dev@servicebay.ai,2025-01-06,2025-01-10,0,
User Model,Create User model,50,Sprint 1,,2025-01-11,2025-01-12,1,
Task Model,Create Task model,25,Sprint 1,dev@servicebay.ai,2025-01-13,2025-01-15,1,
API Development,Build REST APIs,0,Sprint 2,,,2025-01-16,2025-01-31,0,
```

## How to Use

1. **Click "Import CSV"** button on the Tasks page (admin only)
2. **Download template** (optional) to see the correct format
3. **Select your CSV/Excel file** by clicking the upload area
4. **Review file details** (name, size) before importing
5. **Click "Import Tasks"** to start the upload
6. **Monitor progress** via the progress bar
7. **Review results**:
   - Number of tasks imported successfully
   - Number of rows skipped due to errors
   - Detailed error list (if any)
   - Preview of imported tasks

## Validation Rules

### Task Name
- Required
- 1-200 characters
- Cannot be empty

### Progress
- Required
- Must be 0-100 (integer)

### Nesting Level
- Required
- Must be 0, 1, 2, or 3
- 0 = root task
- 1-3 = nested subtasks

### Sprint
- Optional
- Must match an existing sprint name exactly
- Case-sensitive

### Assigned To
- Optional
- Must be a valid email address
- User must exist in the system
- User must be active (not deactivated)

### Dates (Start Date, Deadline)
- Optional
- Accepted formats:
  - ISO 8601: `2025-01-15` or `2025-01-15T10:30:00Z`
  - US format: `01/15/2025`

### Parent ID
- Optional for root tasks (Nesting Level = 0)
- Required for nested tasks (Nesting Level > 0)
- Must be a valid UUID
- Parent task must already exist (import parents before children)

## Common Errors and Solutions

### "Sprint 'X' not found"
**Solution**: Create the sprint first, or remove the Sprint column value

### "User 'email@example.com' not found or inactive"
**Solution**: Ensure the user exists and is active, or leave Assigned To blank

### "Parent task 'uuid' not found"
**Solution**: Import parent tasks first (Nesting Level 0), then import children

### "Missing required columns"
**Solution**: Ensure your CSV has headers: Task Name, Progress, Nesting Level

### "Progress must be 0-100"
**Solution**: Check Progress values are integers between 0 and 100

### "File too large (max 10MB)"
**Solution**: Split your file into smaller files with fewer rows

### "Only CSV and Excel files allowed"
**Solution**: Save your file as .csv, .xlsx, or .xls format

## Best Practices

### 1. Start Small
Test with a small file (5-10 tasks) before importing large datasets

### 2. Create Dependencies First
- Import sprints before importing tasks assigned to them
- Import parent tasks before subtasks
- Ensure all users exist before assigning tasks

### 3. Use the Template
Download the template to see the exact format expected

### 4. Review Before Import
Check your CSV in a spreadsheet app before uploading

### 5. Handle Errors Incrementally
If you get many errors:
1. Fix the errors in your CSV
2. Remove successfully imported rows
3. Re-import the corrected rows

### 6. Hierarchical Import Strategy
For nested tasks:
```csv
# Import in this order:
Row 1: Parent Task (Nesting Level 0) → Get ID
Row 2: Subtask 1 (Nesting Level 1, Parent ID = Row 1 ID)
Row 3: Subtask 2 (Nesting Level 1, Parent ID = Row 1 ID)
Row 4: Sub-subtask (Nesting Level 2, Parent ID = Row 2 ID)
```

### 7. Date Format Consistency
Choose one date format and use it consistently throughout the file

## API Endpoint

For programmatic access:

```bash
POST /api/upload/tasks-import
Content-Type: multipart/form-data

file: <CSV or Excel file>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "imported": 45,
    "skipped": 5,
    "errors": [
      {
        "row": 3,
        "error": "User 'invalid@example.com' not found or inactive"
      }
    ],
    "tasks": [
      {
        "id": "task-uuid",
        "name": "Task 1",
        "progress": 50
      }
    ]
  }
}
```

## Security

- **Admin only**: Only users with ADMIN role can import tasks
- **Rate limited**: 10 uploads per 15 minutes
- **File validation**: Only CSV/Excel files accepted
- **Size limits**: Maximum 10MB per file
- **Row limits**: Maximum 10,000 rows per file
- **Input sanitization**: All data is validated before database insertion

## Troubleshooting

### Import button not visible
**Cause**: You are not logged in as an admin
**Solution**: Contact an administrator to import tasks for you

### Progress bar stuck at 100% but no result
**Cause**: Server is processing the file (large files take longer)
**Solution**: Wait up to 30 seconds for large files

### Network error during upload
**Cause**: Connection interrupted
**Solution**: Check your internet connection and try again

### All rows skipped
**Cause**: CSV format doesn't match expected format
**Solution**: Download template and compare with your file

## Example Files

### Simple Import (3 root tasks)
```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
Setup Project,Initialize project structure,100,Sprint 1,dev@servicebay.ai,2025-01-01,2025-01-03,0,
Design Database,Create schema design,50,Sprint 1,dev@servicebay.ai,2025-01-04,2025-01-10,0,
Implement API,Build REST endpoints,0,Sprint 1,,,2025-01-11,2025-01-31,0,
```

### Hierarchical Import
For nested tasks, you need to:
1. Import parent tasks first
2. Note their IDs from the import result
3. Import child tasks with Parent ID set

**Step 1 - Import Parents:**
```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
Feature A,Main feature,50,Sprint 1,dev@servicebay.ai,2025-01-01,2025-01-31,0,
Feature B,Another feature,25,Sprint 1,dev@servicebay.ai,2025-02-01,2025-02-28,0,
```

**Step 2 - After import, note the task IDs (e.g., feature-a-uuid, feature-b-uuid)**

**Step 3 - Import Children:**
```csv
Task Name,Details,Progress,Sprint,Assigned To,Start Date,Deadline,Nesting Level,Parent ID
Subtask A1,First subtask of A,75,Sprint 1,dev@servicebay.ai,2025-01-05,2025-01-10,1,feature-a-uuid
Subtask A2,Second subtask of A,25,Sprint 1,dev@servicebay.ai,2025-01-11,2025-01-15,1,feature-a-uuid
Subtask B1,First subtask of B,0,Sprint 1,dev@servicebay.ai,2025-02-05,2025-02-10,1,feature-b-uuid
```

## Feature Status

✅ **Backend API**: Fully implemented and tested
✅ **Frontend UI**: Complete with progress tracking
✅ **File validation**: MIME type, size, and format checking
✅ **CSV parsing**: PapaParse with error handling
✅ **Excel support**: XLSX library for .xlsx and .xls files
✅ **Progress tracking**: Real-time upload progress bar
✅ **Error reporting**: Detailed errors per row
✅ **Template download**: Sample CSV with correct format
✅ **Admin-only access**: Role-based authorization
✅ **Rate limiting**: 10 uploads per 15 minutes

## Support

For issues or questions:
1. Check this guide first
2. Download and review the template
3. Test with a small sample file
4. Contact your system administrator if issues persist
