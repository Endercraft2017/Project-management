---
description: Execute tasks from 2tasks.md with file constraints to prevent repo conflicts
---

# Execute Tasks Command

You are tasked with executing specific tasks from the task list in `docs/2tasks.md`. This is a production-grade application, so all code must be secure, well-tested, and production-ready.

## Critical Requirements:

### Quality Standards
- **Production-ready code only** - Never opt for faster methods if they compromise functionality or security
- **No `any` types** - Use proper TypeScript typing for security and maintainability
- **100% working** - Everything must be fully functional before completion
- **Updated standards** - Search for up-to-date information to avoid deprecated/outdated systems
- **Security first** - Strictly follow updated industry security standards and coding standards

### Workflow:

1. **Read task list and constraints**:
   - Read `docs/2tasks.md` to see all available tasks
   - Wait for user to specify which tasks to complete (e.g., "tasks 1-3" or "task 5")
   - Wait for user to specify which files you're allowed to change/modify/add
   - This prevents conflicts in the repository

2. **Plan thoroughly**:
   - Create a detailed implementation plan using the TodoWrite tool
   - Break down each task into concrete steps
   - Think carefully about architecture and security implications
   - Ask clarifying questions before starting implementation

3. **Review documentation**:
   - Read `docs/architecture/system-guide.md` for system architecture
   - Read `docs/architecture/call-pipeline.md` for pipeline details
   - Understand how the tasks fit into existing architecture

4. **Implement each task**:
   - Create tools/features for agents to use
   - Create API endpoints for webapp and mobile app
   - Use proper TypeScript types (no `any`)
   - Follow security best practices
   - Make it production-ready
   - Only modify files specified by the user

5. **Write tests**:
   - Create comprehensive unit tests for each task/feature
   - Ensure all tests pass
   - If tests fail, iterate on the implementation until they pass

6. **Document everything**:
   - Create user documentation in `docs/` folder explaining how to use features
   - Create technical documentation covering implementation details
   - Update `docs/architecture/system-guide.md` to reflect new features in the system
   - Update `docs/architecture/call-pipeline.md` if it affects the pipeline

7. **Research and validate**:
   - Search for current best practices and industry standards
   - Verify no deprecated packages or methods are used
   - Ensure security standards are met

8. **Track progress**:
   - Use TodoWrite to track each task's progress
   - Mark tasks complete only when tests pass
   - Keep documentation updated as you go

## Important Constraints:

- **File restrictions**: Only modify files the user explicitly allows
- **Task restrictions**: Only complete the tasks the user specifies
- **No assumptions**: Ask questions if task requirements are unclear

## Deliverables Per Task:

- [ ] Feature/tool implementation (agent-facing)
- [ ] API endpoint (webapp/mobile app)
- [ ] Unit tests (all passing)
- [ ] User documentation in `docs/`
- [ ] Updated `docs/architecture/system-guide.md`
- [ ] Updated `docs/architecture/call-pipeline.md` (if applicable)
- [ ] Security review completed
- [ ] No `any` types used

## Important Notes:

- Keep the codebase clean - all documentation goes in `docs/`
- Ask questions whenever you need clarification
- Use TodoWrite to track your progress throughout implementation
- Iterate until all tests pass - no exceptions
- Respect file modification constraints to prevent repository conflicts
