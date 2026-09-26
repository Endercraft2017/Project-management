# CSV Import Format Guide

## Overview

The CSV import feature allows you to bulk-create tasks with their subtasks in a single file upload. Each row creates one parent task and optionally multiple subtasks under it.

## CSV Structure

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
```

### Column Descriptions

| Column | Required | Description |
|--------|----------|-------------|
| **Tasks** | Yes | The name of the parent task to create |
| **Subtasks** | No | Comma-separated list of subtask names to create under this parent task |
| **Sprint** | No | The sprint name this task belongs to (will be auto-created if it doesn't exist) |
| **Details** | No | Task description/notes |
| **Progress %** | No | Task completion percentage (0-100). Default: 0 |
| **Assigned to** | No | Email or name of user to assign (must exist in system). Leave empty for "Unassigned" |
| **Deadline** | No | Due date in format: YYYY-MM-DD, MM/DD/YYYY, or DD-MM-YYYY. Leave empty for no deadline (shows "-") |

## How It Works

For each CSV row:
1. **Finds or creates parent task** from the "Tasks" column:
   - If a task with the same name already exists in the same sprint (from a previous row or previous import), it **reuses** that task
   - Otherwise, creates a new Level 0 root task under the sprint
2. **Creates subtasks** from the "Subtasks" column:
   - Comma-separated names are split and each becomes a separate subtask (Level 1)
   - All subtasks are children of the parent task
   - Subtasks inherit the same sprint as their parent
   - Subtasks start with 0% progress and no deadline (these can be edited later in the UI)

### Deduplication Behavior

**Multiple rows with same parent task name:**
```csv
Tasks,Subtasks,Sprint,...
Mobile App UI,"Call Window, Camera Window",Copilot,...
Mobile App UI,"Chat UI, Notification Window",Copilot,...
```

**Result:** Creates **ONE** "Mobile App UI" parent task with **4** subtasks total (Call Window, Camera Window, Chat UI, Notification Window)

This allows you to split a parent task with many subtasks across multiple CSV rows for better readability.

## Examples

### Example 1: Simple Parent Task (No Subtasks)

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
User Authentication,,Sprint 1,Implement OAuth login,25,dev@servicebay.ai,2025-03-15
```

**Result:**
- **Sprint**: "Sprint 1"
- **Task** (Level 0): "User Authentication"
  - Details: "Implement OAuth login"
  - Progress: 25%
  - Assigned to: dev@servicebay.ai
  - Deadline: 2025-03-15

### Example 2: Parent Task with Multiple Subtasks

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Mobile App UI,"Call Window, Camera Window, Chat UI, Notification Window",Copilot,Main mobile interface,30,ui@servicebay.ai,2025-04-01
```

**Result:**
- **Sprint**: "Copilot"
- **Task** (Level 0): "Mobile App UI"
  - Details: "Main mobile interface"
  - Progress: 30%
  - Assigned to: ui@servicebay.ai
  - Deadline: 2025-04-01
  - **Subtasks** (Level 1):
    - "Call Window" (0% progress, unassigned, no deadline)
    - "Camera Window" (0% progress, unassigned, no deadline)
    - "Chat UI" (0% progress, unassigned, no deadline)
    - "Notification Window" (0% progress, unassigned, no deadline)

### Example 3: Multiple Rows

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Database Design,"Schema Design, Migration Scripts, Seed Data",Backend,PostgreSQL setup,50,db@servicebay.ai,2025-02-20
API Development,"REST Endpoints, Authentication, Authorization",Backend,Build core API,30,dev@servicebay.ai,2025-03-10
Frontend Setup,"React Setup, Routing, State Management",Frontend,Initialize React app,75,ui@servicebay.ai,2025-02-15
```

**Result:**
- **Sprint "Backend"** with 2 tasks:
  - "Database Design" with 3 subtasks
  - "API Development" with 3 subtasks
- **Sprint "Frontend"** with 1 task:
  - "Frontend Setup" with 3 subtasks

## Important Notes

### Sprint Auto-Creation
- If a sprint name doesn't exist, it will be automatically created with:
  - Start date: Current date
  - End date: 14 days from now
  - Status: ACTIVE

### User Assignment
- Users must exist in the system (invited or already registered)
- The system searches by email first, then by name
- Inactive users cannot be assigned
- If user is not found, the task will be created as "Unassigned"

### Subtask Formatting
- Use commas to separate multiple subtask names
- Spaces around commas are automatically trimmed
- Example: `"Task 1, Task 2, Task 3"` or `"Task 1,Task 2,Task 3"` both work
- Use quotes if subtask names contain commas internally

### Deadline Formatting
Supported formats:
- `2025-03-15` (YYYY-MM-DD)
- `03/15/2025` (MM/DD/YYYY)
- `15-03-2025` (DD-MM-YYYY)
- Leave empty or use `-` for no deadline

### Progress Validation
- Must be a number between 0 and 100
- Can be decimal (e.g., 33.5)
- Leave empty for 0%

## Task Hierarchy Levels

The system supports up to 4 nesting levels:
- **Level 0**: Root task (parent) - created from CSV
- **Level 1**: Subtask - created from CSV "Subtasks" column
- **Level 2**: Sub-subtask - can be added manually in UI
- **Level 3**: Sub-sub-subtask - can be added manually in UI (maximum depth)

## Migration and Editing

After import, you can:
- **Edit task details** - Click on any field in the task list or open the detail drawer
- **Move tasks to different sprints** - Edit the task and change its sprint
- **Reassign tasks** - Click on the assignee field
- **Change deadlines** - Click on the deadline field
- **Add more subtasks** - Use the "+" button next to any task
- **Migrate subtasks to other parents** - Edit the subtask and change its parent task

## Common Patterns

### Pattern 1: Feature with Components
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Chat System,"Backend API, Frontend UI, Real-time Socket, File Upload",Sprint 2,Complete chat feature,0,,2025-04-30
```

### Pattern 2: Epic with User Stories
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
User Management,"User Registration, User Login, Profile Edit, Password Reset",Sprint 1,User account features,10,dev@servicebay.ai,2025-03-20
```

### Pattern 3: Module with Implementation Steps
```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Payment Integration,"Stripe Setup, Checkout Flow, Webhook Handler, Receipt Generation",Sprint 3,Payment processing,0,backend@servicebay.ai,2025-05-15
```

## Troubleshooting

### Issue: Tasks imported but subtasks missing
**Cause**: Subtasks column might be empty or not properly formatted
**Solution**: Ensure subtask names are comma-separated and the cell is not empty

### Issue: Sprint created but not linked to tasks
**Cause**: Sprint name mismatch (case-sensitive or extra spaces)
**Solution**: Ensure sprint names are exactly the same across rows

### Issue: User assignment failed
**Cause**: User doesn't exist or email/name mismatch
**Solution**: Check user exists in system and email is correct. Task will still be created as "Unassigned"

### Issue: Duplicate tasks created
**Cause**: CSV has duplicate rows
**Solution**: The system does NOT check for duplicates - each row creates new tasks

## Template

Download or copy this template to get started:

```csv
Tasks,Subtasks,Sprint,Details,Progress %,Assigned to,Deadline
Setup Development,"Install Node, Configure Env, Setup Database",Sprint 1,Initial project setup,100,dev@servicebay.ai,2025-01-15
Authentication,"Google OAuth, JWT Tokens, Session Management",Sprint 1,User authentication system,75,dev@servicebay.ai,2025-01-30
API Development,"User Endpoints, Task Endpoints, Sprint Endpoints",Sprint 2,REST API implementation,50,backend@servicebay.ai,2025-02-20
Frontend Setup,"React App, Routing, State Management, UI Components",Sprint 2,Frontend initialization,60,ui@servicebay.ai,2025-02-25
```

## Summary

- **One row** = One parent task + Multiple subtasks
- **Tasks column** = Parent task name (Level 0)
- **Subtasks column** = Comma-separated child task names (Level 1)
- **Sprint, Details, Progress, Assigned to, Deadline** = Apply only to parent task
- **Subtasks inherit** = Sprint from parent, but have 0% progress and no assignment/deadline
- **Edit later** = All task properties can be modified in the UI after import
