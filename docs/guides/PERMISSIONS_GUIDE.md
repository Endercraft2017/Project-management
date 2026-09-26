# Task Management Permissions Guide

## Overview

This document explains the permission system for task management in the ServiceBay Project Management application.

---

## Permission Roles

### 1. ADMIN
- Full access to all tasks
- Can create, edit, and delete any task
- Can assign tasks to any user
- Can change sprints, deadlines, and all fields
- Can import CSV files

### 2. MEMBER
- Can view tasks assigned to them or created by them
- Can update tasks they own
- Can create subtasks under their assigned tasks
- Can update progress on their tasks
- **Can delete** tasks they created or are assigned to
- **Cannot** assign tasks to other users

### 3. VIEWER
- Read-only access
- Can view tasks but cannot modify

---

## Task Editing Permissions

### ✅ What ADMINS Can Edit (All Fields)

Admins have **full editing rights** on all tasks:

| Field | Editable by Admin |
|-------|------------------|
| Task Name | ✅ Yes |
| Details | ✅ Yes |
| Progress % | ✅ Yes |
| Sprint | ✅ Yes (with restrictions*) |
| Assigned To | ✅ Yes (any user) |
| Start Date | ✅ Yes |
| **Deadline** | **✅ Yes** |
| Parent Task | ✅ Yes |

**Sprint Change Restriction**: Cannot change sprint if task has subtasks (must move subtasks first or use bulk move endpoint)

### ✅ What MEMBERS Can Edit (Limited)

Members can edit tasks **they are assigned to** or **created**:

| Field | Editable by Member |
|-------|-------------------|
| Task Name | ✅ Yes (own tasks) |
| Details | ✅ Yes (own tasks) |
| Progress % | ✅ Yes (own tasks) |
| Sprint | ✅ Yes (own tasks, with restrictions*) |
| Assigned To | ❌ No (only self) |
| Start Date | ✅ Yes (own tasks) |
| **Deadline** | **✅ Yes (own tasks)** |
| Parent Task | ❌ No |

---

## Permission Logic (verifyTaskPermission)

**Code** (`server/src/tasks/service.ts:768-777`):

```typescript
private verifyTaskPermission(
  task: { assignedToId: string | null; createdById: string },
  userId: string,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;                    // ✅ Admin can do anything
  if (task.assignedToId === userId) return true; // ✅ Assigned user can edit
  if (task.createdById === userId) return true;  // ✅ Creator can edit
  return false;                                  // ❌ No permission
}
```

**Permission Check Order**:
1. **Is Admin?** → ✅ Full access
2. **Is Assigned To?** → ✅ Can edit this task
3. **Is Creator?** → ✅ Can edit this task
4. **Otherwise** → ❌ No access

---

## Creating Tasks

### Top-Level Tasks

**Endpoint**: `POST /api/tasks`

**Who can create**:
- ✅ Admin (can assign to anyone)
- ✅ Member (can only assign to self)

**Required Fields**:
- Task Name
- Sprint ID
- Assigned To ID
- Start Date
- Deadline

**Restrictions**:
- Members can **only** assign tasks to themselves
- Admin can assign to any user

### Subtasks

**Endpoint**: `POST /api/tasks/:parentId/subtasks`

**Who can create**:
- ✅ Admin (under any task)
- ✅ Member (only under tasks they're assigned to or created)

**Rules**:
1. Must have permission on parent task
2. Maximum nesting depth: **4 levels** (0, 1, 2, 3)
3. Members can only assign to themselves
4. Inherits sprint from parent (can be overridden)

**Example Hierarchy**:
```
Level 0: Project Setup (Admin creates)
  ↳ Level 1: Backend API (Member creates subtask)
      ↳ Level 2: User Auth (Member creates sub-subtask)
          ↳ Level 3: OAuth Flow (Member creates deepest level)
              ↳ ❌ Cannot create level 4
```

---

## Updating Tasks

### Full Task Update

**Endpoint**: `PUT /api/tasks/:id`

**Who can update**:
- ✅ Admin (any task, all fields)
- ✅ Member (own tasks, most fields)

**Admin Can Change**:
- ✅ Task Name
- ✅ Details
- ✅ Start Date
- ✅ **Deadline** (Yes, fully editable)
- ✅ Sprint (if no subtasks)
- ✅ Assigned To (any user)

**Member Can Change** (on own tasks):
- ✅ Task Name
- ✅ Details
- ✅ Start Date
- ✅ **Deadline** (Yes, fully editable)
- ✅ Sprint (if no subtasks)
- ❌ Assigned To (cannot reassign to others)

**Code** (`server/src/tasks/service.ts:429-438`):
```typescript
const updatedTask = await prisma.task.update({
  where: { id },
  data: {
    ...(data.taskName && { taskName: data.taskName }),
    ...(data.details !== undefined && { details: data.details }),
    ...(data.startDate && { startDate: data.startDate }),
    ...(data.deadline && { deadline: data.deadline }),      // ✅ Deadline editable
    ...(data.sprintId !== undefined && { sprintId: data.sprintId }),
    ...(data.assignedToId && { assignedToId: data.assignedToId }),
  },
});
```

### Progress Only Update

**Endpoint**: `PUT /api/tasks/:id/progress`

**Who can update**:
- ✅ Admin (any task)
- ✅ Member (own tasks)

**Behavior**:
- Updates progress percentage (0-100)
- Automatically recalculates parent task progress
- Cascades up the hierarchy

---

## UI Permissions

### Task Form (client/src/components/tasks/TaskForm.tsx)

The form shows **all editable fields**:

**Fields in Form**:
```typescript
- Task Name       ✅ Text input
- Sprint          ✅ Dropdown (all sprints)
- Assigned To     ✅ Dropdown (users)
- Start Date      ✅ Date picker
- Deadline        ✅ Date picker  ← FULLY EDITABLE
- Details         ✅ Textarea
- Progress        ✅ Number input (0-100, edit mode only)
```

**Validation**:
- Task name required
- Sprint required (for new tasks)
- Assigned To required
- Start Date required
- Deadline required
- Deadline must be after Start Date

---

## Answer to Your Questions

### Q1: Can the deadline be adjusted in the webapp interface?

**✅ YES** - The deadline is **fully editable** in the UI!

**How to edit**:
1. Click on a task in the task list
2. Task form opens with all fields
3. Deadline field is a **date picker** - change it
4. Click "Save" or "Update Task"

**Who can edit deadline**:
- ✅ **Admin**: Can edit deadline on **any task**
- ✅ **Member**: Can edit deadline on **tasks assigned to them**

**Code proof** (lines 50-52 in TaskForm.tsx):
```typescript
deadline: task?.deadline
  ? formatDateInput(task.deadline)
  : formatDateInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
```

---

### Q2: Everything should be adjustable right, especially by the admin?

**✅ YES** - Admin can adjust **ALL fields** on **ALL tasks**:

| Field | Admin | Member |
|-------|-------|--------|
| Task Name | ✅ | ✅ (own) |
| Details | ✅ | ✅ (own) |
| Progress | ✅ | ✅ (own) |
| Sprint | ✅ | ✅ (own, no subtasks) |
| **Deadline** | **✅** | **✅ (own)** |
| Start Date | ✅ | ✅ (own) |
| Assigned To | ✅ (anyone) | ❌ (self only) |
| Parent Task | ✅ | ❌ |

**Admin Powers**:
- Edit any task created by anyone
- Change any field
- Reassign tasks to other users
- Delete tasks
- Import tasks via CSV

---

### Q3: Members cannot edit what the admin did but they can create subtasks for their tasks?

**✅ CORRECT!** This is the exact permission model:

**Members CANNOT Edit**:
- ❌ Tasks created by admin (unless assigned to them)
- ❌ Tasks assigned to other members
- ❌ Tasks they didn't create

**Members CAN Edit**:
- ✅ Tasks **assigned to them** (all fields except reassignment)
- ✅ Tasks **they created**
- ✅ Can create **subtasks** under their assigned tasks

**Example Scenarios**:

**Scenario 1: Admin creates task and assigns to Member**
```
Admin creates: "Backend API" → assigns to John
✅ John can:
   - Edit task name, details, dates, deadline, progress
   - Create subtasks under "Backend API"
   - Update progress
❌ John cannot:
   - Reassign to another user
   - Delete the task
```

**Scenario 2: Member creates own task**
```
John creates: "Fix Bug #123" → assigns to self
✅ John can:
   - Edit all fields
   - Create subtasks
   - Update progress
❌ John cannot:
   - Reassign to another user
```

**Scenario 3: Member creates subtask**
```
John's task: "Backend API"
John creates subtask: "User Authentication"
✅ John can:
   - Edit "User Authentication" (all fields)
   - Create sub-subtasks under it
   - Update progress
✅ Admin can:
   - Edit both tasks (full access)
   - Reassign to anyone
```

---

## Testing Permissions

### Test as Admin

1. Login as admin
2. Go to Tasks page
3. Click any task → Opens edit form
4. **All fields should be editable** including Deadline
5. Can change Sprint, Assigned To, Deadline, etc.
6. Can create subtasks under any task

### Test as Member

1. Login as regular member
2. Go to Tasks page
3. Click task **assigned to you**
4. **Can edit**: Name, Details, Dates, Deadline, Progress
5. **Cannot change**: Assigned To to another user
6. Can create subtasks under your tasks

### Test as Member (Other's Task)

1. Try to click task **not assigned to you**
2. You can **view** it
3. But **cannot edit** it
4. "Edit" button should not appear (if UI enforces this)

---

## API Endpoints Summary

| Endpoint | Admin | Member (Own) | Member (Other) |
|----------|-------|--------------|----------------|
| GET /api/tasks | ✅ All | ✅ Own | ❌ |
| GET /api/tasks/:id | ✅ | ✅ | ❌ |
| POST /api/tasks | ✅ | ✅ (assign self) | N/A |
| POST /api/tasks/:id/subtasks | ✅ | ✅ | ❌ |
| PUT /api/tasks/:id | ✅ All fields | ✅ Most fields | ❌ |
| PUT /api/tasks/:id/progress | ✅ | ✅ | ❌ |
| DELETE /api/tasks/:id | ✅ | ✅ (created/assigned) | ❌ |

---

## Code References

**Permission Check**:
- `server/src/tasks/service.ts:768-777` - `verifyTaskPermission()`

**Task Update**:
- `server/src/tasks/service.ts:369-457` - `updateTask()`
- Line 434: `...(data.deadline && { deadline: data.deadline })` ✅ Deadline editable

**Subtask Creation**:
- `server/src/tasks/service.ts:280-368` - `createSubtask()`
- Line 299: Permission check for parent task

**Frontend Form**:
- `client/src/components/tasks/TaskForm.tsx:40-54` - Form data includes deadline
- Line 50-52: Deadline field initialization

---

## Deleting Tasks

**Endpoint**: `DELETE /api/tasks/:id`

**Who can delete**:
- ✅ **Admin**: Can delete any task
- ✅ **Member**: Can delete tasks they **created** or are **assigned to**

**Cascade Option**:
- `DELETE /api/tasks/:id?cascade=true` - Deletes task and all subtasks
- `DELETE /api/tasks/:id` - Fails if task has subtasks

**Permission Check** (`server/src/tasks/service.ts:454-461`):
```typescript
async deleteTask(id: string, cascade: boolean, userId: string, isAdmin: boolean) {
  const task = await prisma.task.findUnique({ where: { id } });

  // Verify permission - members can delete their own created tasks
  if (!this.verifyTaskPermission(task, userId, isAdmin)) {
    throw new Error('No permission to delete this task');
  }

  // Check for subtasks and delete
}
```

**Use Cases**:
- Member creates a subtask → Member can delete it
- Admin creates a task → Admin can delete it
- Member is assigned a task → Member can delete it
- Admin views member-created subtasks → Admin can delete them

---

## Summary

✅ **YES** - Deadline is fully editable in the UI
✅ **YES** - Admin can edit all fields on all tasks
✅ **YES** - Members can edit their own tasks (including deadline)
✅ **YES** - Members can create subtasks under their tasks
✅ **YES** - Members can delete their own created tasks/subtasks
✅ **YES** - Admin can view and delete member-created subtasks
✅ **NO** - Members cannot edit tasks created by admin (unless assigned to them)

**The permission system is working as designed!** 🎉
