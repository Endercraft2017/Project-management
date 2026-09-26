import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('⚠️  RESETTING RAILWAY DATABASE - ALL DATA WILL BE LOST!');
  console.log('');

  try {
    // Drop all data in reverse order of dependencies
    console.log('🗑️  Deleting all data...');

    await prisma.message.deleteMany();
    console.log('✅ Deleted all messages');

    await prisma.threadReply.deleteMany();
    console.log('✅ Deleted all thread replies');

    await prisma.conversationMember.deleteMany();
    console.log('✅ Deleted all conversation members');

    await prisma.conversation.deleteMany();
    console.log('✅ Deleted all conversations');

    await prisma.file.deleteMany();
    console.log('✅ Deleted all files');

    await prisma.syncLog.deleteMany();
    console.log('✅ Deleted all sync logs');

    await prisma.task.deleteMany();
    console.log('✅ Deleted all tasks');

    await prisma.sprint.deleteMany();
    console.log('✅ Deleted all sprints');

    await prisma.invitation.deleteMany();
    console.log('✅ Deleted all invitations');

    await prisma.user.deleteMany();
    console.log('✅ Deleted all users');

    console.log('');
    console.log('✅ DATABASE RESET COMPLETE!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Users need to sign in again (OAuth will recreate accounts)');
    console.log('2. Import your CSV file');
    console.log('3. All data will be fresh from the CSV');

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase()
  .then(() => {
    console.log('');
    console.log('🎉 Reset completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('💥 Reset failed:', error);
    process.exit(1);
  });
