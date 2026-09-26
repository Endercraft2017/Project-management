# How to Use Slash Commands in Claude Code

Slash commands are custom prompts that you can invoke during conversations with Claude to trigger specialized workflows.

## How to Activate Slash Commands

1. **Type `/` in the Claude Code input box** - An autocomplete menu will appear showing all available commands
2. **Select a command** from the dropdown or continue typing the command name
3. **Press Enter** to execute the command
4. **Follow the prompts** - Claude will guide you through the workflow

**Important:**
- Slash commands must be invoked at the **start of a new message**
- After typing the command and pressing Enter, Claude will be loaded with the specialized instructions
- You can then provide additional context or answer any questions Claude asks

## Quick Start Examples

**Debugging an error:**
```
/debug-error
```
Then wait for Claude to read `3logs.md` and start the debugging process.

**Adding a new feature:**
```
/add-feature
```
Then describe what feature you want to add when Claude asks.

**Executing tasks:**
```
/execute-tasks
```
Then specify which tasks (e.g., "Complete tasks 1-3") and which files can be modified.

---

## Available Slash Commands

### `/debug-error` - Error Debugging Workflow

This command helps Claude systematically debug and fix errors in your project.

**When to use:**
- You have errors logged in `3logs.md`
- You need Claude to investigate and fix a bug
- You want documented error resolution for future reference

**How to use:**
```
/debug-error
```

**What it does:**
1. Reads logs from `3logs.md`
2. Analyzes the error using project documentation
3. Searches for solutions in codebase and online
4. Asks you for clarification when needed
5. Implements the fix
6. Documents the error and solution in `docs/error_fixes/`
7. Updates system documentation if architecture changes

---

### `/add-feature` - Production-Grade Feature Development

This command guides Claude through creating a new feature or tool with production-ready code, proper testing, and documentation.

**When to use:**
- You want to add a new feature to the project
- You need a tool that agents can use
- You need API endpoints for webapp and mobile app
- You want production-ready, secure, well-tested code

**How to use:**
```
/add-feature
```

**What it does:**
1. Creates a detailed implementation plan
2. Reviews system architecture documentation
3. Implements the feature with proper TypeScript types (no `any`)
4. Creates API endpoints for webapp and mobile app
5. Writes comprehensive unit tests
6. Iterates until all tests pass
7. Creates user and technical documentation in `docs/`
8. Updates `CLAUDE_SYSTEM_GUIDE.md` and `CALL_PIPELINE_DOCUMENTATION.md`
9. Follows industry security and coding standards
10. Ensures everything is 100% production-ready

**Quality guarantees:**
- No `any` types - proper TypeScript typing
- Security-first approach
- Up-to-date packages and methods (no deprecated code)
- All tests must pass before completion
- Production-grade quality

---

### `/execute-tasks` - Structured Task Execution

This command helps Claude execute specific tasks from your task list (`2tasks.md`) with proper file constraint management to prevent repository conflicts.

**When to use:**
- You have tasks listed in `2tasks.md`
- You want to specify which tasks to complete and which files can be modified
- You need production-ready implementation with tests and documentation
- You want to prevent repository conflicts

**How to use:**
```
/execute-tasks
```

Then specify:
- Which tasks to complete (e.g., "tasks 1-3" or "task 5")
- Which files Claude is allowed to change/modify/add

**What it does:**
1. Reads the task list from `2tasks.md`
2. Waits for you to specify task range and file constraints
3. Creates a detailed plan with TodoWrite
4. Reviews system architecture documentation
5. Implements tasks with proper TypeScript types (no `any`)
6. Creates agent tools and API endpoints
7. Writes and passes unit tests
8. Creates documentation in `docs/`
9. Updates system guides
10. Only modifies allowed files to prevent conflicts

**File constraint safety:**
- Respects user-specified file modification limits
- Prevents accidental changes to restricted files
- Helps avoid repository conflicts

**Quality guarantees:**
- Same production-grade standards as `/add-feature`
- No `any` types, security-first, all tests pass
- Up-to-date packages and industry standards

## Workflow Details

### Using `/debug-error`

**Step-by-step:**
1. Make sure you have errors logged in `docs/3logs.md`
2. Type `/debug-error` and press Enter
3. Claude will automatically:
   - Read the error logs
   - Review system documentation
   - Search for solutions
   - Implement fixes
   - Create documentation in `docs/error_fixes/`
4. Claude may ask you questions if clarification is needed

**Output:**
- Fixed code
- Error documentation in `docs/error_fixes/[error-name].md`
- Updated system guides if needed

---

### Using `/add-feature`

**Step-by-step:**
1. Type `/add-feature` and press Enter
2. Describe the feature you want to add
3. Claude will create a detailed plan and ask for approval
4. Once approved, Claude will:
   - Implement agent tools and API endpoints
   - Write unit tests
   - Create documentation
   - Update system guides
5. Claude will iterate until all tests pass

**Output:**
- Feature implementation (agent-facing tools)
- API endpoints for webapp/mobile
- Passing unit tests
- Feature documentation in `docs/`
- Updated `CLAUDE_SYSTEM_GUIDE.md` and `CALL_PIPELINE_DOCUMENTATION.md`

---

### Using `/execute-tasks`

**Step-by-step:**
1. Make sure you have tasks listed in `docs/2tasks.md`
2. Type `/execute-tasks` and press Enter
3. Claude will read the task list and ask you:
   - **Which tasks to complete** (e.g., "tasks 1-3", "task 5 only")
   - **Which files can be modified** (e.g., "only files in packages/api/src/tools/")
4. Claude creates a plan and executes the tasks
5. Each task gets full implementation, tests, and documentation

**Output:**
- Completed tasks with production-ready code
- API endpoints and agent tools
- Passing unit tests for each task
- Documentation in `docs/`
- Updated system guides

**Safety feature:**
By specifying which files can be modified, you prevent conflicts if you're working on other parts of the codebase simultaneously.

---

## Creating Your Own Slash Commands

1. **Create a markdown file** in `.claude/commands/` directory
2. **Name it descriptively** (e.g., `my-command.md`)
3. **Add frontmatter** with a description:
   ```markdown
   ---
   description: Brief description of what this command does
   ---
   ```
4. **Write your prompt/instructions** in the file
5. **Restart VS Code** and start a new conversation
6. **Use it** by typing `/my-command` in the chat

**Example file structure:**
```markdown
---
description: Brief description shown in autocomplete
---

# My Custom Command

Detailed instructions for Claude explaining what to do.

## Steps:
1. Step one
2. Step two
3. Step three
```

**File location:**
- Project commands: `.claude/commands/` (shared with team via Git)
- Personal commands: `~/.claude/commands/` (only for you)

## Tips

- The `description` field in frontmatter is required for commands to appear in autocomplete
- Slash commands can include specific file paths, workflows, or domain knowledge
- They help maintain consistency across debugging/development sessions
- Commands are loaded when VS Code starts and when new conversations begin
- After creating new commands, restart VS Code to see them
- Commands are project-specific and stored in your `.claude/commands/` folder
