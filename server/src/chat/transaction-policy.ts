import type { Prisma } from '@prisma/client';

export interface LockedMessage {
  id: string; conversationId: string; senderId: string; parentMessageId: string | null;
  isDeleted: boolean; threadRepliesCount: number; reactions: Prisma.JsonValue; createdAt: Date;
}
/** Queries use the transaction client's validated tenant schema search_path. */
export async function lockMessage(tx: Prisma.TransactionClient, id: string): Promise<LockedMessage | null> {
  const rows = await tx.$queryRaw<LockedMessage[]>`
    SELECT id,"conversationId","senderId","parentMessageId","isDeleted","threadRepliesCount",reactions,"createdAt"
    FROM messages WHERE id=${id} FOR UPDATE`;
  return rows[0] || null;
}
/** Keep active-account and membership authorization stable until commit. */
export async function lockConversationMember(tx: Prisma.TransactionClient, conversationId: string, userId: string) {
  const members = await tx.$queryRaw<Array<{ isAdmin: boolean }>>`
    SELECT m."isAdmin" FROM conversation_members m JOIN users u ON u.id=m."userId"
    WHERE m."conversationId"=${conversationId} AND m."userId"=${userId} AND u."isActive"=true
    FOR SHARE OF m,u`;
  if (!members.length) throw new Error('Not a member of this conversation');
  return members[0];
}
