# CSV Import Troubleshooting Guide

## Issue: Import shows "success" but 0 tasks created

### Root Cause

The import service **silently skips rows** when:
1. **Sprint doesn't exist** in the database
2. **User doesn't exist** or is inactive
3. **Parent task doesn't exist** (for subtasks)

The frontend shows "Imported: 0, Skipped: X" but users might miss the "Skipped" count.

### Solution

**Option 1: Leave optional fields empty** (Recommended for testing)

Use this CSV format to import without dependencies:

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
My First Task,,,Task description here,50,,2025-02-01
My Second Task,,,Another task,75,,2025-02-15
```

**Option 2: Create dependencies first**

Before importing, ensure:

1. **Create Sprints** (if using Sprint column):
   ```
   - Go to application
   - Create Sprint 1, Sprint 2, etc.
   - Match exact names in CSV
   ```

2. **Verify Users exist** (if using Assigned to column):
   ```
   - Check user exists in database
   - User must be active (isActive = true)
   - Use exact email or name match
   ```

3. **Import in correct order** (for hierarchies):
   ```
   - Import parent tasks first
   - Then import subtasks that reference them
   ```

---

## Checking Server Logs

The server now has detailed logging. Check console for:

```
[Import] Parsing file: uploads/1234567890.csv
[Import] Parsed 4 rows
[Import] Headers validated successfully
[Import] Valid rows: 4, Validation errors: 0
[Import] Starting task creation...
[Import] Row 2: Looking for sprint 'Sprint 1'
[Import] Row 2: Sprint 'Sprint 1' not found - skipping row  ← ERROR HERE
[Import] Row 3: Looking for user 'test@servicebay.ai'
[Import] Row 3: User 'test@servicebay.ai' not found - skipping row  ← ERROR HERE
```

---

## Error Messages Explained

### "Sprint 'X' not found"

**Cause**: Sprint doesn't exist in database

**Solutions**:
1. Create the sprint in the app first
2. Leave Sprint column empty in CSV
3. Use empty value: `My Task,,,Details,50,,2025-01-01`

### "User 'X' not found or inactive"

**Cause**: User doesn't exist or `isActive = false`

**Solutions**:
1. Ensure user has logged in at least once (creates account)
2. Check user is active in database
3. Leave Assigned to column empty
4. Use format: `My Task,,,Details,50,,2025-01-01`

### "Parent task 'X' not found"

**Cause**: Trying to create subtask before parent exists

**Solutions**:
1. Import parent tasks first
2. Then import subtasks in separate upload
3. Or ensure parent is earlier in the same CSV file

---

## Testing Import Step-by-Step

### Step 1: Simple Import (No Dependencies)

**File**: `test-import-simple.csv`

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Test Task 1,,,This is a test task,50,,2025-02-01
Test Task 2,,,Another test task,75,,2025-02-15
```

**Expected**: 2 tasks imported, 0 skipped

### Step 2: Import with Sprint

**Prerequisites**: Create "Sprint 1" in the app first

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Task with Sprint,,Sprint 1,This task has a sprint,60,,2025-02-01
```

**Expected**: 1 task imported, assigned to Sprint 1

### Step 3: Import with User Assignment

**Prerequisites**: User must exist (login first to create account)

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Assigned Task,,,This is assigned,80,john@servicebay.ai,2025-02-01
```

**Expected**: 1 task imported, assigned to user

### Step 4: Import Hierarchies

**Two uploads**:

**Upload 1 - Parents**:
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Parent Task 1,,,Main task,50,,2025-02-01
Parent Task 2,,,Another main task,60,,2025-02-10
```

**Upload 2 - Children** (after parents are imported):
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Child Task A,Parent Task 1,,Subtask of Parent Task 1,25,,2025-01-25
Child Task B,Parent Task 1,,Another subtask,30,,2025-01-28
Child Task C,Parent Task 2,,Subtask of Parent Task 2,40,,2025-02-05
```

**Expected**:
- Upload 1: 2 root tasks
- Upload 2: 3 subtasks linked to parents

---

## Recommended CSV Template

**For first-time users** (no dependencies):

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Setup Development,,,Install tools and dependencies,100,,2025-01-15
Database Design,,,Design schema and models,75,,2025-01-20
API Implementation,,,Build REST endpoints,50,,2025-02-01
Frontend Development,,,Create React components,25,,2025-02-10
Testing,,,Write unit and integration tests,0,,2025-02-20
```

**For advanced users** (with sprints and assignments):

1. Create Sprint 1 and Sprint 2 in the app
2. Ensure users have logged in
3. Use this CSV:

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Backend API,Sprint 1,Complete backend implementation,60,john@servicebay.ai,2025-01-31
Frontend UI,,Sprint 1,Build user interface,40,jane@servicebay.ai,2025-01-31
User Auth,Backend API,Sprint 1,Implement OAuth login,80,john@servicebay.ai,2025-01-20
Task List,Frontend UI,Sprint 1,Create task list view,50,jane@servicebay.ai,2025-01-25
```

---

## Quick Fixes

### Fix 1: Remove Sprint Column

If you don't want to deal with sprints:

**Before**:
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
My Task,,Sprint 1,Description,50,,2025-01-01
```

**After** (leave empty):
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
My Task,,,Description,50,,2025-01-01
```

### Fix 2: Remove User Assignment

If users don't exist yet:

**Before**:
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
My Task,,,Description,50,john@servicebay.ai,2025-01-01
```

**After** (leave empty):
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
My Task,,,Description,50,,2025-01-01
```

### Fix 3: Simplified Format

Minimal CSV (only required columns):

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
My Task,,,Some details,50,,
Another Task,,,More details,75,,
```

---

## Verifying Import Success

### Check Import Results Dialog

Look for:
- ✅ **Imported: 5** ← Tasks successfully created
- ⚠️ **Skipped: 0** ← Should be 0 for success
- ❌ **Errors** ← Should be empty or explain why rows skipped

### Check Server Console

Look for log lines:
```
[Import] Parsed 5 rows
[Import] Valid rows: 5, Validation errors: 0
[Import] Starting task creation...
[Import] Row 2: No sprint specified (OK)
[Import] Row 2: No user assignment (OK)
[Audit] User xxx imported 5 tasks from file xxx
```

### Check Tasks Page

- Refresh the tasks list
- You should see the newly imported tasks
- Expand parent tasks to see subtasks

---

## Still Not Working?

### 1. Check Database Connection

Server console should show:
```
✓ Database connection established
```

### 2. Check File Was Uploaded

Server logs should show:
```
[Import] Parsing file: uploads/1234567890-random.csv
```

### 3. Check Validation Errors

If you see:
```
[Import] Valid rows: 0, Validation errors: 5
```

Then all rows failed validation. Check:
- Column names exactly match: `Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline`
- Progress % values are 0-100
- No special characters in column headers

### 4. Export Error Log

The import result shows errors. Copy them and check:
- What row number
- What specific error
- Fix in CSV and re-upload

---

## Contact Support

If you've tried all the above and still have issues:

1. **Check server console logs** (copy last 50 lines)
2. **Check browser console** (F12 → Console tab)
3. **Check import result** (screenshot the errors section)
4. **Share your CSV** (first 5 rows including headers)

Provide these details for faster troubleshooting.
