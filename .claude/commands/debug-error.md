---
description: Debug and fix errors from 3logs.md with full documentation
---

# Error Debugging Command

You are tasked with debugging and fixing an error in the project.

## Instructions:

1. **Read the logs**: Check `docs/3logs.md` for error details and stack traces
2. **Understand the context**: Refer to these documentation files for project architecture:
   - `docs/architecture/system-guide.md` - System overview and architecture
   - `docs/architecture/call-pipeline.md` - Call pipeline details
3. **Search for solutions**: Use available tools to search the codebase and web for solutions
4. **Ask when uncertain**: If you need clarification or manual intervention, ask the user
5. **Fix the problem**: Implement the fix with proper testing
6. **Update documentation**:
   - Create a new markdown file in `docs/error_fixes/` to document the error and solution
   - Update `docs/architecture/system-guide.md` and `docs/architecture/call-pipeline.md` if your changes affect the architecture or pipeline
7. **Keep documentation in sync**: Always update relevant documentation files when implementing changes so future debugging sessions have accurate information
8. **Update Repo**: Once all test passed, CI/CD and build commit and push the updates to repo

## Documentation Requirements:

When creating the error fix documentation, include:
- Error description and symptoms
- Root cause analysis
- Solution implemented
- Files changed
- Testing performed
- Date and any relevant context
