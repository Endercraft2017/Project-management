/**
 * MentionInput Component
 * Textarea with @ mention autocomplete
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useConversationMembers } from '@/hooks/useConversationMembers';
import type { User } from '@/types';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  conversationId: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  conversationId,
  placeholder = 'Type a message...',
  disabled = false,
}: MentionInputProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Fetch conversation members for autocomplete
  const { data: membersData } = useConversationMembers(conversationId);
  const members = membersData?.members || [];

  // Filter members based on search
  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(autocompleteSearch.toLowerCase())
  );

  // Detect @ character and show autocomplete
  useEffect(() => {
    const cursorPos = cursorPosition;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Find the last @ character before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    // Check if @ is at start or after a space
    const isValidMention =
      lastAtIndex !== -1 &&
      (lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1]));

    if (isValidMention) {
      // Extract text after @
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // Only show autocomplete if no space after @
      if (!/\s/.test(textAfterAt)) {
        setAutocompleteSearch(textAfterAt);
        setShowAutocomplete(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowAutocomplete(false);
  }, [value, cursorPosition]);

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  };

  // Handle click to update cursor position
  const handleClick = () => {
    setCursorPosition(textareaRef.current?.selectionStart || 0);
  };

  // Insert mention at cursor position
  const insertMention = (member: User) => {
    const cursorPos = cursorPosition;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);

    // Find the @ character
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    // Replace @search with @[userId](userName)
    const before = value.substring(0, lastAtIndex);
    const mentionText = `@[${member.id}](${member.name}) `;
    const newValue = before + mentionText + textAfterCursor;

    onChange(newValue);
    setShowAutocomplete(false);

    // Set cursor after the mention
    setTimeout(() => {
      const newCursorPos = (before + mentionText).length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
      setCursorPosition(newCursorPos);
    }, 0);
  };

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete) {
      // Handle Enter to submit (Shift+Enter for new line)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    // Autocomplete is open
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredMembers.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;

      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredMembers[selectedIndex]) {
          insertMention(filteredMembers[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        break;

      default:
        break;
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Scroll selected item into view
  useEffect(() => {
    if (showAutocomplete && autocompleteRef.current) {
      const selectedElement = autocompleteRef.current.children[
        selectedIndex
      ] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, showAutocomplete]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleClick}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        style={{ maxHeight: '150px', minHeight: '44px' }}
      />

      {/* Autocomplete Dropdown */}
      {showAutocomplete && filteredMembers.length > 0 && (
        <div
          ref={autocompleteRef}
          className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {filteredMembers.map((member, index) => (
            <button
              key={member.id}
              type="button"
              onClick={() => insertMention(member)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
            >
              {member.picture && (
                <img
                  src={member.picture}
                  alt={member.name}
                  className="h-6 w-6 rounded-full"
                />
              )}
              <div className="flex-1">
                <div className="font-medium">{member.name}</div>
                <div className="text-xs text-muted-foreground">{member.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Hint text */}
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>Press Enter to send, Shift+Enter for new line. Type @ to mention someone.</span>
        {value.includes('@[') && (
          <span className="text-primary">✓ Mentions will be formatted after sending</span>
        )}
      </div>
    </div>
  );
}
