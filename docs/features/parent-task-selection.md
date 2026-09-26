# Parent Task Selection in Task Creation

## Overview

This feature allows users to select a parent task when creating a new task, enabling the creation of hierarchical task structures directly from the task creation form.

**Feature Date**: 2025-10-22

## Feature Description

When creating a new task, users can now optionally select an existing task as the parent. This creates a parent-child relationship where the new task becomes a subtask of the selected parent.

### Key Capabilities

1. **Optional Parent Selection**: Users can choose to create root-level tasks (no parent) or nested tasks (with parent)
2. **Searchable Dropdown**: A searchable dropdown interface for finding and selecting parent tasks
3. **Nesting Level Filtering**: Only tasks that are below the maximum nesting depth (level 3) can be selected as parents
4. **Sprint Inheritance**: When a parent is selected, the new task can inherit the sprint from the parent
5. **Automatic Nesting Level**: The system automatically calculates and sets the correct nesting level based on the parent

## User Interface

### Task Creation Form

The parent task selector appears in the task creation form with the following features:

- **Location**: Below the sprint selector, above the "Assigned To" field
- **Label**: "Parent Task (Optional - for nesting)"
- **Default Value**: "No Parent (Root Task)"
- **Search**: Type to filter tasks by name
- **Grouping**: Tasks are grouped by nesting level (Level 0, Level 1, Level 2)
- **Display**: Shows task name and associated sprint

### Visual Hierarchy

```
Task Form
├── Task Name
├── Sprint
├── Parent Task (NEW)
│   ├── No Parent (Root Task) [default]
│   ├── Level 0 Tasks
│   ├── Level 1 Tasks
│   └── Level 2 Tasks
├── Assigned To
├── Start Date
└── Deadline
```

## Technical Implementation

### Frontend Changes

**File**: `client/src/components/tasks/TaskForm.tsx`

#### Changed Condition

**Before**:
```typescript
{isEdit && (
  <div>
    <label>Parent Task (Optional - for nesting)</label>
    ...
  </div>
)}
```

**After**:
```typescript
{!isSubtask && (
  <div>
    <label>Parent Task (Optional - for nesting)</label>
    ...
  </div>
)}
```

This change makes the parent task selector visible in:
- ✅ Create mode (new feature)
- ✅ Edit mode (existing functionality)
- ❌ Subtask mode (hidden - parent is already set via "Add Subtask" button)

### Backend Changes

**File**: `server/src/tasks/service.ts`

#### Enhanced `createTask` Method

The `createTask` method now handles the `parentTaskId` parameter:

1. **Parent Task Validation**:
   - Verifies parent task exists
   - Checks user has permission to create tasks under the parent
   - Validates nesting depth limit (max level 3)

2. **Sprint Inheritance**:
   - If `parentTaskId` is provided without `sprintId`, inherits sprint from parent
   - If both are provided, uses the specified sprint

3. **Automatic Nesting Level**:
   - Calculates `nestingLevel` as `parent.nestingLevel + 1`
   - Sets to 0 for root-level tasks

#### Key Code Addition

```typescript
// If parentTaskId is provided, validate and get parent task details
if (data.parentTaskId) {
  parentTask = await prisma.task.findUnique({
    where: { id: data.parentTaskId },
  });

  if (!parentTask) {
    throw new Error('Parent task not found');
  }

  // Verify permission on parent task
  if (!this.verifyTaskPermission(parentTask, userId, isAdmin)) {
    throw new Error('No permission to create task under this parent');
  }

  // Verify nesting depth limit (max level is 3)
  if (parentTask.nestingLevel >= 3) {
    throw new Error(
      'Maximum nesting depth (4 levels) reached. Cannot create task under this parent.'
    );
  }

  // Inherit sprint from parent if not explicitly provided
  if (!sprintId) {
    sprintId = parentTask.sprintId;
  }

  // Calculate nesting level
  nestingLevel = parentTask.nestingLevel + 1;
}

// Create task with parentTaskId and calculated nestingLevel
const task = await prisma.task.create({
  data: {
    // ... other fields
    parentTaskId: data.parentTaskId || null,
    nestingLevel: nestingLevel,
  },
});
```

## API Changes

### POST /api/tasks

The existing endpoint now accepts an optional `parentTaskId` field:

**Request Body**:
```json
{
  "taskName": "Child Task",
  "sprintId": "uuid", // optional if parent has sprint
  "parentTaskId": "uuid", // NEW: optional parent task ID
  "assignedToId": "uuid",
  "startDate": "2025-03-01",
  "deadline": "2025-03-07",
  "details": "Task description"
}
```

**Behavior**:
- If `parentTaskId` is provided and valid:
  - Creates task as child of specified parent
  - Sets `nestingLevel` to `parent.nestingLevel + 1`
  - Inherits `sprintId` from parent if not provided
  - Returns 201 with created task

- If `parentTaskId` is omitted or null:
  - Creates root-level task
  - Sets `nestingLevel` to 0
  - Requires `sprintId` to be provided
  - Returns 201 with created task

**Error Responses**:
- `404`: Parent task not found
- `403`: No permission to create task under parent
- `400`: Maximum nesting depth exceeded
- `400`: Validation errors (missing required fields, invalid UUIDs, etc.)

## Business Rules

### Nesting Depth Limit

- **Maximum Depth**: 4 levels (0-3)
- **Parent Eligibility**: Only tasks at levels 0, 1, or 2 can be parents
- **Enforcement**: Backend validates before creation

### Sprint Inheritance

- **With Parent + No Sprint**: Inherits parent's sprint
- **With Parent + With Sprint**: Uses specified sprint (can differ from parent)
- **No Parent**: Sprint is required

### Permissions

- **Creating Under Parent**: Requires permission on parent task (creator, assignee, or admin)
- **Assignment**: Same rules as regular task creation (admins can assign to anyone, members only to themselves)

## Use Cases

### Use Case 1: Creating a Subtask from Scratch

**Scenario**: User wants to create a subtask under an existing task without using the "Add Subtask" button.

**Steps**:
1. Click "Create Task" button
2. Enter task name
3. Click on "Parent Task" dropdown
4. Search for or select the parent task
5. Fill in other fields (assignment, dates, etc.)
6. Submit

**Result**: New task is created as a child of the selected parent with correct nesting level.

### Use Case 2: Creating a Root Task

**Scenario**: User wants to create a top-level task.

**Steps**:
1. Click "Create Task" button
2. Enter task name
3. Leave "Parent Task" as "No Parent (Root Task)"
4. Select sprint
5. Fill in other fields
6. Submit

**Result**: New root-level task is created with `nestingLevel` 0 and no parent.

### Use Case 3: Organizing Related Tasks

**Scenario**: User has created several tasks and wants to organize them hierarchically.

**Steps**:
1. Create parent task "Feature Development"
2. Create child task selecting "Feature Development" as parent
3. Create another child task also selecting "Feature Development" as parent

**Result**: Hierarchical structure is established with multiple children under one parent.

## Testing

### Unit Tests

**File**: `tests/feature/task-management.test.ts`

Added comprehensive test suite covering:

1. ✅ Creating task with `parentTaskId` and correct nesting level
2. ✅ Inheriting sprint from parent when not provided
3. ✅ Rejecting `parentTaskId` that exceeds nesting depth
4. ✅ Rejecting non-existent `parentTaskId`
5. ✅ Creating root task without `parentTaskId` (backward compatibility)

### Manual Testing Checklist

- [ ] Parent task selector appears in "Create Task" form
- [ ] Parent task selector does NOT appear when clicking "Add Subtask" button
- [ ] Search functionality works in parent dropdown
- [ ] Tasks are grouped by level correctly
- [ ] Selecting "No Parent" creates root-level task
- [ ] Selecting a parent creates nested task with correct level
- [ ] Sprint inheritance works when parent is selected without sprint
- [ ] Cannot select tasks at level 3 as parents
- [ ] Error handling for invalid parent IDs
- [ ] Permission checks work correctly

## Backward Compatibility

This feature is **fully backward compatible**:

- ✅ Existing code that creates tasks without `parentTaskId` continues to work
- ✅ Tasks without `parentTaskId` are created as root-level tasks (nestingLevel 0)
- ✅ The "Add Subtask" button workflow remains unchanged
- ✅ All existing API contracts are maintained

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Operations**: Move multiple tasks under a new parent
2. **Drag-and-Drop**: Visual drag-and-drop to reorganize task hierarchy
3. **Parent Task Preview**: Show parent task details when hovering in dropdown
4. **Recently Used Parents**: Quick selection of recently used parent tasks
5. **Smart Suggestions**: Suggest parent tasks based on sprint, assignee, or tags

## Related Features

- **Subtask Creation via Button**: [TaskNode.tsx:202-210](client/src/components/tasks/TaskNode.tsx#L202-L210)
- **Task Hierarchy Display**: [TaskNode.tsx](client/src/components/tasks/TaskNode.tsx)
- **Edit Task Parent**: Already supported in edit mode

## Documentation References

- API Documentation: `/docs/api/tasks.md`
- Task Management Plan: `/docs/plans/05-task-management-plan.md`
- System Architecture: `packages/api/src/CLAUDE_SYSTEM_GUIDE.md` (to be updated)
