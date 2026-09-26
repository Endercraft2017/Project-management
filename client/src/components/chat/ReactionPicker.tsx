/**
 * Reaction Picker Component
 * Allows users to select emoji reactions for messages
 */

import { useState } from 'react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import * as Popover from '@radix-ui/react-popover';
import { Smile } from 'lucide-react';

// Quick reactions (most common)
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

interface ReactionPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export default function ReactionPicker({ onEmojiSelect }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  const handleQuickReaction = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Add reaction"
        >
          <Smile className="h-4 w-4" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 rounded-lg border border-border bg-popover shadow-lg"
          sideOffset={5}
          align="start"
        >
          <div className="p-2">
            {/* Quick Reactions */}
            <div className="flex gap-1 mb-2 pb-2 border-b border-border">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleQuickReaction(emoji)}
                  className="text-2xl hover:bg-accent rounded p-1 transition-colors"
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Full Emoji Picker */}
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={320}
              height={400}
              searchPlaceHolder="Search emojis..."
              previewConfig={{ showPreview: false }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
