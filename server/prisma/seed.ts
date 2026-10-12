/**
 * Database Seed Script
 * Populates database with initial data for development and testing
 */

import { PrismaClient, Role, SprintStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin users
  const admin1 = await prisma.user.upsert({
    where: { email: 'admin@servicebay.ai' },
    update: {},
    create: {
      email: 'admin@servicebay.ai',
      name: 'Admin User',
      role: Role.ADMIN,
      picture: 'https://ui-avatars.com/api/?name=Admin+User',
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: 'john.admin@servicebay.ai' },
    update: {},
    create: {
      email: 'john.admin@servicebay.ai',
      name: 'John Admin',
      role: Role.ADMIN,
      picture: 'https://ui-avatars.com/api/?name=John+Admin',
    },
  });

  console.log('✅ Created admin users');

  // Create member users
  const member1 = await prisma.user.upsert({
    where: { email: 'jane.dev@servicebay.ai' },
    update: {},
    create: {
      email: 'jane.dev@servicebay.ai',
      name: 'Jane Developer',
      role: Role.MEMBER,
      picture: 'https://ui-avatars.com/api/?name=Jane+Developer',
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: 'bob.dev@servicebay.ai' },
    update: {},
    create: {
      email: 'bob.dev@servicebay.ai',
      name: 'Bob Developer',
      role: Role.MEMBER,
      picture: 'https://ui-avatars.com/api/?name=Bob+Developer',
    },
  });

  const member3 = await prisma.user.upsert({
    where: { email: 'alice.dev@servicebay.ai' },
    update: {},
    create: {
      email: 'alice.dev@servicebay.ai',
      name: 'Alice Developer',
      role: Role.MEMBER,
      picture: 'https://ui-avatars.com/api/?name=Alice+Developer',
    },
  });

  console.log('✅ Created member users');

  // Every user belongs to the original organization, which the multi-tenancy
  // migration creates with this fixed id
  const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
  for (const user of [admin1, admin2, member1, member2, member3]) {
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: DEFAULT_ORGANIZATION_ID, userId: user.id } },
      update: {},
      create: { organizationId: DEFAULT_ORGANIZATION_ID, userId: user.id, role: user.role },
    });
  }

  console.log('✅ Added users to the organization');

  // Create sprints
  const sprint1 = await prisma.sprint.create({
    data: {
      name: 'MVP Sprint 1',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-14'),
      status: SprintStatus.ACTIVE,
      createdById: admin1.id,
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      name: 'MVP Sprint 2',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-01-28'),
      status: SprintStatus.PLANNED,
      createdById: admin1.id,
    },
  });

  console.log('✅ Created sprints');

  // Create tasks with hierarchy
  const task1 = await prisma.task.create({
    data: {
      taskName: 'Implement Authentication',
      sprintId: sprint1.id,
      details: 'Set up Google OAuth 2.0 authentication with domain restriction',
      progress: 50,
      assignedToId: member1.id,
      startDate: new Date('2025-01-01'),
      deadline: new Date('2025-01-05'),
      nestingLevel: 0,
      createdById: admin1.id,
    },
  });

  const subtask1_1 = await prisma.task.create({
    data: {
      taskName: 'Setup Passport.js',
      sprintId: sprint1.id,
      parentTaskId: task1.id,
      details: 'Configure Passport with Google OAuth strategy',
      progress: 100,
      assignedToId: member1.id,
      startDate: new Date('2025-01-01'),
      deadline: new Date('2025-01-03'),
      nestingLevel: 1,
      createdById: member1.id,
    },
  });

  const subtask1_2 = await prisma.task.create({
    data: {
      taskName: 'Implement Domain Restriction',
      sprintId: sprint1.id,
      parentTaskId: task1.id,
      details: 'Restrict login to @servicebay.ai domain',
      progress: 75,
      assignedToId: member1.id,
      startDate: new Date('2025-01-03'),
      deadline: new Date('2025-01-05'),
      nestingLevel: 1,
      createdById: member1.id,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      taskName: 'Database Schema Design',
      sprintId: sprint1.id,
      details: 'Design PostgreSQL schema with Prisma',
      progress: 100,
      assignedToId: member2.id,
      startDate: new Date('2025-01-01'),
      deadline: new Date('2025-01-04'),
      nestingLevel: 0,
      createdById: admin1.id,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      taskName: 'Task Management API',
      sprintId: sprint1.id,
      details: 'Implement CRUD operations for tasks',
      progress: 25,
      assignedToId: member3.id,
      startDate: new Date('2025-01-05'),
      deadline: new Date('2025-01-10'),
      nestingLevel: 0,
      createdById: admin1.id,
    },
  });

  const task4 = await prisma.task.create({
    data: {
      taskName: 'Chat System',
      sprintId: sprint2.id,
      details: 'Implement real-time chat with Socket.io',
      progress: 0,
      assignedToId: member2.id,
      startDate: new Date('2025-01-15'),
      deadline: new Date('2025-01-20'),
      nestingLevel: 0,
      createdById: admin1.id,
    },
  });

  console.log('✅ Created tasks with hierarchy');

  // Create conversations
  const dmConversation = await prisma.conversation.create({
    data: {
      type: 'DM',
      createdById: member1.id,
      members: {
        create: [
          { userId: member1.id, isAdmin: false },
          { userId: member2.id, isAdmin: false },
        ],
      },
    },
  });

  const groupConversation = await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name: 'Development Team',
      description: 'Main development team chat',
      createdById: admin1.id,
      members: {
        create: [
          { userId: admin1.id, isAdmin: true },
          { userId: member1.id, isAdmin: false },
          { userId: member2.id, isAdmin: false },
          { userId: member3.id, isAdmin: false },
        ],
      },
    },
  });

  console.log('✅ Created conversations');

  // Create sample messages
  await prisma.message.create({
    data: {
      conversationId: dmConversation.id,
      senderId: member1.id,
      content: 'Hey! How is the database schema coming along?',
    },
  });

  await prisma.message.create({
    data: {
      conversationId: dmConversation.id,
      senderId: member2.id,
      content: 'Going great! Just finished the Prisma schema.',
    },
  });

  await prisma.message.create({
    data: {
      conversationId: groupConversation.id,
      senderId: admin1.id,
      content: 'Welcome to the team chat! Feel free to discuss anything project-related here.',
    },
  });

  await prisma.message.create({
    data: {
      conversationId: groupConversation.id,
      senderId: member1.id,
      content: 'Thanks! Excited to be working on this project.',
      reactions: {
        '👍': [admin1.id, member2.id],
      },
    },
  });

  console.log('✅ Created sample messages');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
