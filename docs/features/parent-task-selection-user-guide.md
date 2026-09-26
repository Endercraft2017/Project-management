# How to Use Parent Task Selection

## Quick Start Guide

This guide explains how to create tasks with parent-child relationships using the new Parent Task selector.

## What is a Parent Task?

A parent task allows you to organize tasks hierarchically. When you create a task with a parent, it becomes a **subtask** of that parent. This is useful for:

- Breaking down large tasks into smaller pieces
- Organizing related tasks together
- Creating multi-level project structures

## Creating a Task with a Parent

### Step 1: Open Task Creation Form

Click the **"Create Task"** button to open the task creation form.

### Step 2: Fill in Basic Details

1. Enter a **Task Name**
2. Select a **Sprint** (optional if you select a parent task)

### Step 3: Select a Parent Task (Optional)

You'll see a field labeled **"Parent Task (Optional - for nesting)"**.

**To create a ROOT-level task** (no parent):
- Leave it as **"No Parent (Root Task)"** (the default)

**To create a SUBTASK** (with parent):
1. Click on the parent task dropdown
2. Type to search for a specific task
3. Tasks are organized by level:
   - **Level 0**: Top-level tasks
   - **Level 1**: First-level subtasks
   - **Level 2**: Second-level subtasks
4. Click on a task to select it as the parent

### Step 4: Complete Other Fields

- **Assigned To**: Choose who will work on the task
- **Start Date**: When the task begins
- **Deadline**: When the task is due
- **Details**: Additional task description (optional)

### Step 5: Submit

Click **"Create Task"** to save your new task.

## Examples

### Example 1: Creating a Simple Subtask

**Scenario**: You have a task "Build Login System" and want to add a subtask.

**Steps**:
1. Click "Create Task"
2. Enter name: "Design Login UI"
3. Select Parent: Search for and select "Build Login System"
4. Assign to yourself
5. Set dates
6. Submit

**Result**: "Design Login UI" is now a subtask of "Build Login System"

### Example 2: Creating a Multi-Level Structure

**Scenario**: Building a feature with multiple levels of tasks.

**Structure you want**:
```
User Authentication (Level 0)
├── Backend API (Level 1)
│   ├── Create Login Endpoint (Level 2)
│   └── Create Register Endpoint (Level 2)
└── Frontend UI (Level 1)
    ├── Design Login Form (Level 2)
    └── Design Register Form (Level 2)
```

**Steps**:
1. Create "User Authentication" with no parent → Level 0
2. Create "Backend API" with parent "User Authentication" → Level 1
3. Create "Create Login Endpoint" with parent "Backend API" → Level 2
4. Create "Create Register Endpoint" with parent "Backend API" → Level 2
5. Create "Frontend UI" with parent "User Authentication" → Level 1
6. Create "Design Login Form" with parent "Frontend UI" → Level 2
7. Create "Design Register Form" with parent "Frontend UI" → Level 2

## Alternative: Using the "Add Subtask" Button

If you're viewing a task and want to quickly create a subtask under it:

1. Hover over the task in the task list
2. Click the **Plus (+)** icon that appears
3. The form opens with the parent already selected
4. Fill in the task details and submit

This is faster when you know exactly which task you want to add a subtask to.

## Limitations

- **Maximum Depth**: You can only create 4 levels of tasks (0 through 3)
- **Parent Eligibility**: Only tasks at levels 0, 1, or 2 can have children
- **Sprint Inheritance**: If you select a parent that has a sprint, your new task will inherit that sprint (unless you explicitly choose a different one)

## Tips

1. **Use Search**: If you have many tasks, use the search feature to quickly find the parent you want
2. **Check the Level**: Pay attention to which level your parent is at to understand where your new task will be in the hierarchy
3. **Sprint Auto-Fill**: When you select a parent task, the sprint field automatically fills with the parent's sprint (you can still change it if needed)
4. **Organize as You Go**: It's easier to set the parent when creating the task rather than editing it later

## Troubleshooting

**Problem**: I can't see some tasks in the parent dropdown.

**Solution**: Tasks at the maximum nesting level (Level 3) cannot be parents. Only tasks at levels 0-2 can have children.

---

**Problem**: The dropdown says "No tasks found".

**Solution**: Either you have no existing tasks, or your search term doesn't match any task names. Clear the search or create a root task first.

---

**Problem**: I don't see the Parent Task field.

**Solution**: The field is hidden when you use the "Add Subtask" button because the parent is already set. Use "Create Task" button to see the parent selector.

## Related Features

- **Editing Parent**: You can change a task's parent later by editing the task
- **Task Hierarchy View**: Tasks are displayed in a tree structure showing the parent-child relationships
- **Add Subtask Button**: Quick way to add subtasks to a specific parent

## Need Help?

If you have questions or issues with this feature, contact your system administrator or check the technical documentation at `docs/features/parent-task-selection.md`.
