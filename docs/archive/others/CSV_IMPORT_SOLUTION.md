# CSV Import Parent-Child Relationship Fix

## Problem
Database shows all tasks at level 0 with no parent relationships, even though the CSV import code has been fixed to properly handle parent-child relationships.

## Root Cause
The existing data in the database was imported **before** the CSV import fix was committed. The fix is in the code (commit 744ce61), but the database still contains the old flat data structure.

## Solution
You need to **re-import your CSV data** to establish the correct parent-child relationships.

### Steps to Fix:

1. **Delete all existing tasks** using the "Delete All Tasks" button in the TaskTree UI (admin only)

2. **Re-import your CSV file** with the correct structure

### CSV Structure Requirements

The CSV structure works like this:

| Column | Usage |
|--------|-------|
| **Tasks** | The name of the task/subtask being created |
| **Subtasks** | The name of the PARENT task (leave empty for root tasks) |
| **Sprint** | The sprint this task belongs to |

#### Example: Sprint → Task → Subtask

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Mobile App UI,,Copilot,Main mobile interface,30,dev@servicebay.ai,2025-03-01
Call Window,Mobile App UI,Copilot,Video call window UI,50,dev@servicebay.ai,2025-02-15
Camera Window,Mobile App UI,Copilot,Camera settings window,25,dev@servicebay.ai,2025-02-15
Chat UI,Mobile App UI,Copilot,Chat interface,60,dev@servicebay.ai,2025-02-20
```

**Result:**
- **Sprint**: "Copilot"
- **Task** (Level 0): "Mobile App UI"
  - Parent: Sprint "Copilot"
  - parentTaskId: null
  - nestingLevel: 0
- **Subtasks** (Level 1): "Call Window", "Camera Window", "Chat UI"
  - Parent: Task "Mobile App UI"
  - parentTaskId: <Mobile App UI's ID>
  - nestingLevel: 1

#### Example: Multi-Level Hierarchy

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Backend API,,WebApp,Backend services,40,,2025-04-01
User Authentication,Backend API,WebApp,Auth module,70,,2025-03-15
OAuth Integration,User Authentication,WebApp,Google OAuth,80,,2025-03-10
```

**Result:**
- **Sprint**: "WebApp"
- **Task** (Level 0): "Backend API"
  - nestingLevel: 0
- **Subtask** (Level 1): "User Authentication"
  - Parent: "Backend API"
  - nestingLevel: 1
- **Sub-subtask** (Level 2): "OAuth Integration"
  - Parent: "User Authentication"
  - nestingLevel: 2

### Maximum Nesting Level
The system supports up to 4 levels:
- Level 0: Root task (Sprint → Task)
- Level 1: Subtask (Task → Subtask)
- Level 2: Sub-subtask (Subtask → Sub-subtask)
- Level 3: Sub-sub-subtask (maximum depth)

## How the Import Works

### Pass 1: Root Tasks
- Processes rows where the "Subtasks" column is EMPTY
- Creates tasks with `nestingLevel = 0` and `parentTaskId = null`
- Associates task with the specified Sprint

### Pass 2: Child Tasks
- Processes rows where the "Subtasks" column has a VALUE
- Looks up the parent task by name (value in "Subtasks" column)
- Calculates `nestingLevel = parent.nestingLevel + 1`
- Creates task with `parentTaskId = <parent's ID>`
- If parent task doesn't exist, it auto-creates one

## Verification

After re-importing, you can verify the hierarchy by checking:

1. **In the UI**: Tasks should show with proper indentation and expand/collapse icons
2. **In the database**: Run this query:
```javascript
const tasks = await prisma.task.findMany({
  select: {
    taskName: true,
    nestingLevel: true,
    parentTask: { select: { taskName: true } },
    sprint: { select: { name: true } }
  },
  orderBy: [
    { sprintId: 'asc' },
    { nestingLevel: 'asc' },
    { taskName: 'asc' }
  ]
});
```

You should see:
- Root tasks with `nestingLevel: 0` and `parentTask: null`
- Subtasks with `nestingLevel: 1` and `parentTask: { taskName: "Parent Name" }`
- And so on for deeper levels

## Summary
The CSV import fix is complete and working correctly in the code. You just need to delete the old flat data and re-import your CSV file to establish the proper parent-child relationships.
