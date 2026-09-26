/**
 * New Message Dialog Component
 * Allows users to start a new DM or group conversation
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, MessageSquarePlus, User, Users as UsersIcon, Search } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useCreateConversation } from '@/hooks/useConversations';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  onConversationCreated?: (conversationId: string) => void;
}

export default function NewMessageDialog({
  open,
  onOpenChange,
  currentUserId,
  onConversationCreated,
}: NewMessageDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [conversationType, setConversationType] = useState<'DM' | 'GROUP'>('DM');
  const [groupName, setGroupName] = useState('');

  const { data: usersData } = useUsers({ isActive: true });
  const createConversation = useCreateConversation();
  const { toast } = useToast();

  const users = (Array.isArray(usersData?.data?.users) ? usersData.data.users : []).filter((u) => u.id !== currentUserId);
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleUserToggle = (userId: string) => {
    if (conversationType === 'DM') {
      setSelectedUsers([userId]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'No users selected',
        description: 'Please select at least one user',
        variant: 'warning',
      });
      return;
    }

    if (conversationType === 'GROUP' && !groupName.trim()) {
      toast({
        title: 'Group name required',
        description: 'Please enter a name for the group',
        variant: 'warning',
      });
      return;
    }

    try {
      const result = await createConversation.mutateAsync({
        type: conversationType,
        memberIds: selectedUsers,
        name: conversationType === 'GROUP' ? groupName : undefined,
      });

      toast({
        title: 'Conversation created',
        description: `${conversationType === 'DM' ? 'Direct message' : 'Group'} created successfully`,
        variant: 'success',
      });

      // Reset form
      setSearch('');
      setSelectedUsers([]);
      setGroupName('');
      onOpenChange(false);

      // Notify parent to select the new conversation
      if (onConversationCreated && result && typeof result === 'object' && 'id' in result) {
        onConversationCreated(result.id as string);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to create conversation',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'error',
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              New Message
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Conversation Type Tabs */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => {
                setConversationType('DM');
                setSelectedUsers([]);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2',
                conversationType === 'DM'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <User className="h-4 w-4" />
              Direct Message
            </button>
            <button
              onClick={() => {
                setConversationType('GROUP');
                setSelectedUsers([]);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2',
                conversationType === 'GROUP'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <UsersIcon className="h-4 w-4" />
              Group
            </button>
          </div>

          {/* Group Name Input (only for groups) */}
          {conversationType === 'GROUP' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] border border-border rounded-md">
            {filteredUsers.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No members found
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserToggle(user.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-accent',
                      selectedUsers.includes(user.id) && 'bg-accent'
                    )}
                  >
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    {selectedUsers.includes(user.id) && (
                      <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <svg
                          className="h-3 w-3 text-primary-foreground"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedUsers.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedUsers.length} {selectedUsers.length === 1 ? 'member' : 'members'} selected
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={createConversation.isPending || selectedUsers.length === 0}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {createConversation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
