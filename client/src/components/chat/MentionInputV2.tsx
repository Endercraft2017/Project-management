/**
 * MentionInput Component V2
 * Contenteditable div with @ mention autocomplete and visual formatting
 * Shows @UserName while storing @[userId](userName) internally
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useConversationMembers } from '@/hooks/useConversationMembers';
import { useTasks } from '@/hooks/useTasks';
import type { User, Task } from '@/types';
import { escapeHtml } from '@/lib/utils';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  conversationId: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function MentionInputV2({
  value,
  onChange,
  onSubmit,
  conversationId,
  placeholder = 'Type a message...',
  disabled = false,
}: MentionInputProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const [autocompleteType, setAutocompleteType] = useState<'user' | 'task'>('user');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const contentEditableRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Fetch conversation members for autocomplete
  const { data: membersData } = useConversationMembers(conversationId);
  const members = membersData?.members || [];

  // Fetch tasks for task mentions (members only see their assigned tasks)
  const { data: tasksData } = useTasks({ limit: 100 });
  const tasks = tasksData?.data || [];

  // Filter members based on search
  const filteredMembers = members
    .filter((member) =>
      member.name.toLowerCase().includes(autocompleteSearch.toLowerCase())
    )
    .slice(0, 10); // Best practice: limit to 10 suggestions

  // Filter tasks based on search
  const filteredTasks = tasks
    .filter((task) =>
      task.taskName.toLowerCase().includes(autocompleteSearch.toLowerCase())
    )
    .slice(0, 10); // Best practice: limit to 10 suggestions

  // Convert stored format to display format
  // @[userId](userName) -> <span class="mention-chip">@userName</span>
  // $[taskId](taskName) -> <span class="task-mention-chip">$taskName</span>
  const getDisplayHTML = (text: string): string => {
    // Escape first so typed text and user/task names can never become markup
    let html = escapeHtml(text);
    // User mentions
    html = html.replace(
      /@\[([a-f0-9-]{36})\]\(([^)]+)\)/g,
      '<span class="mention-chip" data-user-id="$1" contenteditable="false">@$2</span>'
    );
    // Task mentions
    html = html.replace(
      /\$\[([a-f0-9-]{36})\]\(([^)]+)\)/g,
      '<span class="task-mention-chip" data-task-id="$1" contenteditable="false">$$$2</span>'
    );
    return html;
  };

  // Convert display format back to stored format
  const getStoredValue = (): string => {
    if (!contentEditableRef.current) return '';

    // Get the innerHTML and convert it
    const html = contentEditableRef.current.innerHTML;

    // If empty or just whitespace
    if (!html || html.trim() === '' || html === '<br>') return '';

    const clone = contentEditableRef.current.cloneNode(true) as HTMLElement;

    // Replace user mention chips with stored format
    const mentionChips = clone.querySelectorAll('.mention-chip');
    mentionChips.forEach((chip) => {
      const userId = chip.getAttribute('data-user-id');
      const userName = chip.textContent?.replace('@', '') || '';
      const textNode = document.createTextNode(`@[${userId}](${userName})`);
      chip.parentNode?.replaceChild(textNode, chip);
    });

    // Replace task mention chips with stored format
    const taskChips = clone.querySelectorAll('.task-mention-chip');
    taskChips.forEach((chip) => {
      const taskId = chip.getAttribute('data-task-id');
      const taskName = chip.textContent?.replace('$', '') || '';
      const textNode = document.createTextNode(`$[${taskId}](${taskName})`);
      chip.parentNode?.replaceChild(textNode, chip);
    });

    // Get text content and clean up
    let text = clone.textContent || '';

    // Replace non-breaking spaces with regular spaces
    text = text.replace(/\u00A0/g, ' ');

    // Trim and return
    return text.trim();
  };

  // Save cursor position
  const saveCursorPosition = (): { node: Node; offset: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return {
      node: range.startContainer,
      offset: range.startOffset,
    };
  };

  // Restore cursor position
  const restoreCursorPosition = (saved: { node: Node; offset: number } | null) => {
    if (!saved || !contentEditableRef.current) return;

    try {
      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      range.setStart(saved.node, Math.min(saved.offset, saved.node.textContent?.length || 0));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {
      // If cursor position can't be restored, just ignore
      console.warn('Could not restore cursor position:', e);
    }
  };

  // Update contenteditable when value changes externally
  useEffect(() => {
    if (!contentEditableRef.current) return;

    const displayHTML = getDisplayHTML(value);
    const currentHTML = contentEditableRef.current.innerHTML;

    // Only update if different to avoid cursor issues
    if (displayHTML !== currentHTML && !contentEditableRef.current.matches(':focus')) {
      // Only update if not focused (prevents cursor jumping while typing)
      contentEditableRef.current.innerHTML = displayHTML || '';
    }
  }, [value]);

  // Handle input changes
  const handleInput = () => {
    const storedValue = getStoredValue();
    console.log('[MentionInput] handleInput - storedValue:', storedValue);
    onChange(storedValue);

    // Check for @ or $ to trigger autocomplete
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || '';

    // Check for @ (user mention)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const isValidUserMention =
      lastAtIndex !== -1 &&
      (lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1]));

    if (isValidUserMention) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(textAfterAt)) {
        setAutocompleteSearch(textAfterAt);
        setAutocompleteType('user');
        setShowAutocomplete(true);
        setSelectedIndex(0);
        return;
      }
    }

    // Check for $ (task mention)
    const lastDollarIndex = textBeforeCursor.lastIndexOf('$');
    const isValidTaskMention =
      lastDollarIndex !== -1 &&
      (lastDollarIndex === 0 || /\s/.test(textBeforeCursor[lastDollarIndex - 1]));

    if (isValidTaskMention) {
      const textAfterDollar = textBeforeCursor.substring(lastDollarIndex + 1);
      if (!/\s/.test(textAfterDollar)) {
        setAutocompleteSearch(textAfterDollar);
        setAutocompleteType('task');
        setShowAutocomplete(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowAutocomplete(false);
  };

  // Insert user mention at cursor
  const insertMention = (member: User) => {
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || '';
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    // Remove the @ and search text
    range.setStart(range.startContainer, lastAtIndex);
    range.deleteContents();

    // Create mention chip
    const mentionChip = document.createElement('span');
    mentionChip.className = 'mention-chip';
    mentionChip.setAttribute('data-user-id', member.id);
    mentionChip.setAttribute('contenteditable', 'false');
    mentionChip.textContent = `@${member.name}`;

    // Insert mention chip followed by a space
    range.insertNode(mentionChip);
    const spaceNode = document.createTextNode('\u00A0'); // Non-breaking space
    range.setStartAfter(mentionChip);
    range.insertNode(spaceNode);
    range.setStartAfter(spaceNode);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    setShowAutocomplete(false);
    contentEditableRef.current.focus();

    // Update value
    const storedValue = getStoredValue();
    onChange(storedValue);
  };

  // Insert task mention at cursor
  const insertTaskMention = (task: Task) => {
    if (!contentEditableRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || '';
    const lastDollarIndex = textBeforeCursor.lastIndexOf('$');

    // Remove the $ and search text
    range.setStart(range.startContainer, lastDollarIndex);
    range.deleteContents();

    // Create task mention chip
    const taskChip = document.createElement('span');
    taskChip.className = 'task-mention-chip';
    taskChip.setAttribute('data-task-id', task.id);
    taskChip.setAttribute('contenteditable', 'false');
    taskChip.textContent = `$${task.taskName}`;

    // Insert task mention chip followed by a space
    range.insertNode(taskChip);
    const spaceNode = document.createTextNode('\u00A0'); // Non-breaking space
    range.setStartAfter(taskChip);
    range.insertNode(spaceNode);
    range.setStartAfter(spaceNode);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    setShowAutocomplete(false);
    contentEditableRef.current.focus();

    // Update value
    const storedValue = getStoredValue();
    onChange(storedValue);
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!showAutocomplete) {
      // Handle Enter to submit (Shift+Enter for new line)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    // Autocomplete is open
    const items = autocompleteType === 'user' ? filteredMembers : filteredTasks;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;

      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (autocompleteType === 'user' && filteredMembers[selectedIndex]) {
          insertMention(filteredMembers[selectedIndex]);
        } else if (autocompleteType === 'task' && filteredTasks[selectedIndex]) {
          insertTaskMention(filteredTasks[selectedIndex]);
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

  // Handle paste (remove formatting)
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

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
      <div
        ref={contentEditableRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="mention-input w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        data-placeholder={placeholder}
        style={{
          maxHeight: '150px',
          minHeight: '44px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        suppressContentEditableWarning
      />

      {/* Autocomplete Dropdown - User Mentions */}
      {showAutocomplete && autocompleteType === 'user' && filteredMembers.length > 0 && (
        <div
          ref={autocompleteRef}
          className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-50"
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

      {/* Autocomplete Dropdown - Task Mentions */}
      {showAutocomplete && autocompleteType === 'task' && filteredTasks.length > 0 && (
        <div
          ref={autocompleteRef}
          className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-50"
        >
          {filteredTasks.map((task, index) => (
            <button
              key={task.id}
              type="button"
              onClick={() => insertTaskMention(task)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
            >
              <div className="flex-1">
                <div className="font-medium">{task.taskName}</div>
                <div className="text-xs text-muted-foreground">
                  {task.assignedTo?.name || 'Unassigned'} • Progress: {task.progress}%
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Hint text */}
      <div className="mt-1 text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line. Type @ to mention someone, $ to mention a task.
      </div>
    </div>
  );
}
