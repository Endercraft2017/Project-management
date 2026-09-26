/**
 * Database Integration Tests
 * Tests database schema, relationships, and CRUD operations
 */

import { PrismaClient, Role, SprintStatus, ConversationType } from '@prisma/client';

const prisma = new PrismaClient();

// Test data
const testUser = {
  email: 'test.user@servicebay.ai',
  name: 'Test User',
  role: Role.MEMBER,
};

describe('Database Schema Tests', () => {
  // Clean up before and after tests
  beforeAll(async () => {
    // Connect to test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.message.deleteMany({});
    await prisma.conversationMember.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.sprint.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('User Model', () => {
    it('should create a user', async () => {
      const user = await prisma.user.create({
        data: testUser,
      });

      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email);
      expect(user.name).toBe(testUser.name);
      expect(user.role).toBe(Role.MEMBER);
      expect(user.isActive).toBe(true);
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should enforce unique email constraint', async () => {
      await expect(
        prisma.user.create({
          data: testUser,
        })
      ).rejects.toThrow();
    });

    it('should find user by email', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe(testUser.email);
    });

    it('should update user role', async () => {
      const user = await prisma.user.update({
        where: { email: testUser.email },
        data: { role: Role.ADMIN },
      });

      expect(user.role).toBe(Role.ADMIN);
    });
  });

  describe('Sprint Model', () => {
    let userId: string;

    beforeAll(async () => {
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      userId = user!.id;
    });

    it('should create a sprint', async () => {
      const sprint = await prisma.sprint.create({
        data: {
          name: 'Test Sprint',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-14'),
          status: SprintStatus.PLANNED,
          createdById: userId,
        },
      });

      expect(sprint).toBeDefined();
      expect(sprint.name).toBe('Test Sprint');
      expect(sprint.status).toBe(SprintStatus.PLANNED);
    });

    it('should retrieve sprint with creator', async () => {
      const sprint = await prisma.sprint.findFirst({
        where: { name: 'Test Sprint' },
        include: { createdBy: true },
      });

      expect(sprint).toBeDefined();
      expect(sprint?.createdBy.email).toBe(testUser.email);
    });
  });

  describe('Task Model with Hierarchy', () => {
    let userId: string;
    let sprintId: string;

    beforeAll(async () => {
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      userId = user!.id;

      const sprint = await prisma.sprint.findFirst({
        where: { name: 'Test Sprint' },
      });
      sprintId = sprint!.id;
    });

    it('should create a top-level task', async () => {
      const task = await prisma.task.create({
        data: {
          taskName: 'Top Level Task',
          sprintId,
          details: 'Test task details',
          progress: 0,
          assignedToId: userId,
          startDate: new Date('2025-01-01'),
          deadline: new Date('2025-01-05'),
          nestingLevel: 0,
          createdById: userId,
        },
      });

      expect(task).toBeDefined();
      expect(task.taskName).toBe('Top Level Task');
      expect(task.nestingLevel).toBe(0);
      expect(task.parentTaskId).toBeNull();
    });

    it('should create a subtask', async () => {
      const parentTask = await prisma.task.findFirst({
        where: { taskName: 'Top Level Task' },
      });

      const subtask = await prisma.task.create({
        data: {
          taskName: 'Subtask 1',
          sprintId,
          parentTaskId: parentTask!.id,
          details: 'Subtask details',
          progress: 50,
          assignedToId: userId,
          startDate: new Date('2025-01-01'),
          deadline: new Date('2025-01-03'),
          nestingLevel: 1,
          createdById: userId,
        },
      });

      expect(subtask).toBeDefined();
      expect(subtask.parentTaskId).toBe(parentTask!.id);
      expect(subtask.nestingLevel).toBe(1);
    });

    it('should retrieve task with subtasks', async () => {
      const task = await prisma.task.findFirst({
        where: { taskName: 'Top Level Task' },
        include: { subtasks: true },
      });

      expect(task).toBeDefined();
      expect(task?.subtasks).toHaveLength(1);
      expect(task?.subtasks[0].taskName).toBe('Subtask 1');
    });

    it('should cascade delete subtasks when parent is deleted', async () => {
      const parentTask = await prisma.task.findFirst({
        where: { taskName: 'Top Level Task' },
      });

      await prisma.task.delete({
        where: { id: parentTask!.id },
      });

      const subtasks = await prisma.task.findMany({
        where: { parentTaskId: parentTask!.id },
      });

      expect(subtasks).toHaveLength(0);
    });
  });

  describe('Conversation and Message Models', () => {
    let user1Id: string;
    let user2Id: string;

    beforeAll(async () => {
      const user1 = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      user1Id = user1!.id;

      const user2 = await prisma.user.create({
        data: {
          email: 'test.user2@servicebay.ai',
          name: 'Test User 2',
          role: Role.MEMBER,
        },
      });
      user2Id = user2.id;
    });

    it('should create a DM conversation', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          type: ConversationType.DM,
          createdById: user1Id,
          members: {
            create: [
              { userId: user1Id, isAdmin: false },
              { userId: user2Id, isAdmin: false },
            ],
          },
        },
        include: { members: true },
      });

      expect(conversation).toBeDefined();
      expect(conversation.type).toBe(ConversationType.DM);
      expect(conversation.name).toBeNull();
      expect(conversation.members).toHaveLength(2);
    });

    it('should create a GROUP conversation', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          type: ConversationType.GROUP,
          name: 'Test Group',
          description: 'Test group chat',
          createdById: user1Id,
          members: {
            create: [
              { userId: user1Id, isAdmin: true },
              { userId: user2Id, isAdmin: false },
            ],
          },
        },
        include: { members: true },
      });

      expect(conversation).toBeDefined();
      expect(conversation.type).toBe(ConversationType.GROUP);
      expect(conversation.name).toBe('Test Group');
      expect(conversation.members).toHaveLength(2);
      expect(conversation.members.find((m) => m.userId === user1Id)?.isAdmin).toBe(true);
    });

    it('should create messages in conversation', async () => {
      const conversation = await prisma.conversation.findFirst({
        where: { type: ConversationType.DM },
      });

      const message = await prisma.message.create({
        data: {
          conversationId: conversation!.id,
          senderId: user1Id,
          content: 'Test message',
        },
      });

      expect(message).toBeDefined();
      expect(message.content).toBe('Test message');
      expect(message.isEdited).toBe(false);
      expect(message.isDeleted).toBe(false);
    });

    it('should add reactions to message', async () => {
      const message = await prisma.message.findFirst({
        where: { content: 'Test message' },
      });

      const updatedMessage = await prisma.message.update({
        where: { id: message!.id },
        data: {
          reactions: {
            '👍': [user1Id, user2Id],
            '❤️': [user1Id],
          },
        },
      });

      expect(updatedMessage.reactions).toBeDefined();
      expect(updatedMessage.reactions).toHaveProperty('👍');
      expect(updatedMessage.reactions).toHaveProperty('❤️');
    });
  });

  describe('Database Constraints', () => {
    it('should enforce progress range (0-100)', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      const sprint = await prisma.sprint.findFirst();

      await expect(
        prisma.task.create({
          data: {
            taskName: 'Invalid Task',
            sprintId: sprint!.id,
            progress: 150, // Invalid
            assignedToId: user!.id,
            startDate: new Date(),
            deadline: new Date(),
            nestingLevel: 0,
            createdById: user!.id,
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce nesting level range (0-3)', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      const sprint = await prisma.sprint.findFirst();

      await expect(
        prisma.task.create({
          data: {
            taskName: 'Invalid Task',
            sprintId: sprint!.id,
            progress: 0,
            assignedToId: user!.id,
            startDate: new Date(),
            deadline: new Date(),
            nestingLevel: 5, // Invalid
            createdById: user!.id,
          },
        })
      ).rejects.toThrow();
    });
  });
});
