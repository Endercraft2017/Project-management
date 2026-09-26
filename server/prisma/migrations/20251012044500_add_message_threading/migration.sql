-- Add threading columns to messages table
ALTER TABLE messages
ADD COLUMN "parentMessageId" TEXT,
ADD COLUMN "threadRepliesCount" INTEGER DEFAULT 0 NOT NULL;

-- Add foreign key constraint for self-referential relation
ALTER TABLE messages
ADD CONSTRAINT messages_parentMessageId_fkey
FOREIGN KEY ("parentMessageId")
REFERENCES messages(id)
ON DELETE CASCADE;

-- Create index for thread queries
CREATE INDEX messages_parentMessageId_idx ON messages("parentMessageId");
