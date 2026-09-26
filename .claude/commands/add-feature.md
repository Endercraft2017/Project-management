---
description: Create production-grade features with agent tools, API endpoints, tests, and docs
---

# Add Feature/Tool Command

You are tasked with creating a new feature or tool for the project. This is a production-grade application, so all code must be secure, well-tested, and production-ready.

## Critical Requirements:

### Quality Standards
- **Production-ready code only** - Never opt for faster methods if they compromise functionality or security
- **No `any` types** - Use proper TypeScript typing for security and maintainability
- **100% working** - Everything must be fully functional before completion
- **Updated standards** - Search for up-to-date information to avoid deprecated/outdated systems
- **Security first** - Strictly follow updated industry security standards and coding standards

### Implementation Steps:

1. **Plan thoroughly**:
   - Create a detailed implementation plan using the TodoWrite tool
   - Think carefully about architecture and security implications
   - Ask clarifying questions before starting implementation

2. **Review documentation**:
   - Read `docs/architecture/system-guide.md` for system architecture
   - Read `docs/architecture/call-pipeline.md` for pipeline details
   - Understand how the feature fits into existing architecture

3. **Implement the feature**:
   - Create the tool/feature for agents to use
   - Create API endpoint for webapp and mobile app
   - Use proper TypeScript types (no `any`)
   - Follow security best practices
   - Make it production-ready

4. **Write tests**:
   - Create comprehensive unit tests for the feature
   - Ensure all tests pass
   - If tests fail, iterate on the implementation until they pass

5. **Document everything**:
   - Create user documentation in `docs/` folder explaining how to use the feature
   - Create technical documentation covering implementation details
   - Update `docs/architecture/system-guide.md` to reflect new feature in the system
   - Update `docs/architecture/call-pipeline.md` if it affects the pipeline

6. **Research and validate**:
   - Search for current best practices and industry standards
   - Verify no deprecated packages or methods are used
   - Ensure security standards are met

## Deliverables:

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
- Once all test passed and eveything is done, commit and push to repo