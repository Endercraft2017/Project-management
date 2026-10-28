import { useEffect, useRef, useState } from "react";
import { Edit, Send, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useSendMessage } from "@/hooks/useMessages";
import { getSocket } from "@/lib/socket";
import MentionInputV2 from "./MentionInputV2";

interface MessageInputProps {
  conversationId: string;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
}

export default function MessageInput(props: MessageInputProps) {
  // A conversation/edit change gets its own pending state and draft. A late
  // acknowledgement cannot clear text entered in another conversation.
  return (
    <Composer
      key={`${props.conversationId}:${props.editingMessage?.id || "new"}`}
      {...props}
    />
  );
}

function Composer({
  conversationId,
  editingMessage,
  onCancelEdit,
}: MessageInputProps) {
  const [message, setMessage] = useState(editingMessage?.content || "");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  const live = useRef(true);
  const sendMessage = useSendMessage();
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  async function handleSend() {
    if (pendingRef.current || !message.trim()) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      if (editingMessage) {
        const socket = getSocket();
        if (!socket?.connected)
          throw new Error("Chat is reconnecting. Your edit is still here.");
        await new Promise<void>((resolve, reject) => {
          socket.timeout(15000).emit(
            "edit_message",
            {
              messageId: editingMessage.id,
              content: message.trim(),
            },
            (
              timeout: Error | null,
              response?: { success?: boolean; error?: string },
            ) => {
              if (timeout)
                reject(
                  new Error(
                    "Confirmation timed out. Check the message before retrying; your edit is still here.",
                  ),
                );
              else if (!response?.success)
                reject(
                  new Error("The edit was not saved. Your text is still here."),
                );
              else resolve();
            },
          );
        });
      } else {
        await sendMessage.mutateAsync({
          conversationId,
          content: message.trim(),
        });
      }
      if (live.current) {
        setMessage("");
        setShowEmojiPicker(false);
        if (editingMessage) onCancelEdit?.();
      }
    } catch (failure) {
      if (live.current)
        setError(
          editingMessage && failure instanceof Error
            ? failure.message
            : "Send was not confirmed. Your draft is still here. Check the conversation before retrying.",
        );
    } finally {
      pendingRef.current = false;
      if (live.current) setPending(false);
    }
  }

  return (
    <div className="border-t border-border bg-card p-4" aria-busy={pending}>
      {editingMessage && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-primary bg-primary/10 p-2">
          <div className="flex items-center gap-2">
            <Edit className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Editing message
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            disabled={pending}
            className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="relative flex items-start gap-2">
        <div className="relative flex-1">
          <MentionInputV2
            value={message}
            onChange={setMessage}
            onSubmit={() => {
              void handleSend();
            }}
            conversationId={conversationId}
            disabled={pending}
          />
          <button
            type="button"
            aria-label="Choose emoji"
            aria-expanded={showEmojiPicker}
            disabled={pending}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2 top-2 hidden rounded p-1 hover:bg-accent md:block"
          >
            <Smile className="h-5 w-5 text-muted-foreground" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 z-10 mb-2">
              <EmojiPicker
                onEmojiClick={(emoji) => {
                  setMessage((previous) => previous + emoji.emoji);
                  setShowEmojiPicker(false);
                }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label={editingMessage ? "Save message" : "Send message"}
          onClick={() => {
            void handleSend();
          }}
          disabled={!message.trim() || pending}
          className="mt-1 rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
