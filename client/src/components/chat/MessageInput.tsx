/**
 * Message Input Component with Mentions and Emoji Picker
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, X, HardDrive, Upload, Edit } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useSendMessage } from '@/hooks/useMessages';
import { emit } from '@/lib/socket';
import MentionInputV2 from './MentionInputV2';
import { useGooglePicker, type DriveFile } from '@/hooks/useGooglePicker';
import DriveReauthPrompt from '@/components/auth/DriveReauthPrompt';

interface MessageInputProps {
  conversationId: string;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
}

export default function MessageInput({ conversationId, editingMessage, onCancelEdit }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const sendMessage = useSendMessage();
  const { openPicker, isLoaded, error: pickerError, requiresReauth, handleReauth, dismissReauth, retryLoad } = useGooglePicker();

  // Update message when editingMessage changes
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
      setSelectedFiles([]); // Clear files when editing
    }
  }, [editingMessage]);

  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = () => {
    console.log('[MessageInput] handleSend called - message:', message, 'trimmed:', message.trim());

    // If editing a message, emit edit event
    if (editingMessage) {
      if (message.trim()) {
        console.log('[MessageInput] Editing message:', editingMessage.id);
        emit('edit_message', { messageId: editingMessage.id, content: message.trim() });
      }
      // Always clear and cancel after attempting edit
      setMessage('');
      onCancelEdit?.();
      return;
    }

    // Allow sending if there's either a message or files
    if (message.trim() || selectedFiles.length > 0) {
      console.log('[MessageInput] Sending message:', { conversationId, content: message, files: selectedFiles.length });

      sendMessage.mutate({
        conversationId,
        content: message,
        driveFileIds: selectedFiles.map(f => f.id),
      });

      setMessage('');
      setSelectedFiles([]);
      setShowEmojiPicker(false);
    } else {
      console.log('[MessageInput] Message and files are empty, not sending');
    }
  };

  const handleCancel = () => {
    setMessage('');
    setSelectedFiles([]);
    onCancelEdit?.();
  };

  const handleGoogleDriveClick = () => {
    setShowAttachMenu(false);
    openPicker((files) => {
      setSelectedFiles((prev) => [...prev, ...files]);
    });
  };

  const handleLocalFileClick = () => {
    setShowAttachMenu(false);
    fileInputRef.current?.click();
  };

  const handleLocalFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    console.log('[MessageInput] Local files selected:', fileArray.map(f => f.name));

    setIsUploading(true);

    // Upload each file to user's Google Drive
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        setUploadProgress(`Uploading ${i + 1}/${fileArray.length}: ${file.name}`);
        console.log('[MessageInput] Uploading to Drive:', file.name);

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/auth/drive/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        const result = await response.json();

        if (result.success && result.data) {
          // Add uploaded file to selected files
          const driveFile: DriveFile = {
            id: result.data.fileId,
            name: result.data.fileName,
            mimeType: result.data.mimeType,
            sizeBytes: result.data.size,
            url: result.data.webViewLink,
            iconUrl: result.data.iconLink,
          };

          setSelectedFiles((prev) => [...prev, driveFile]);
          console.log('[MessageInput] File uploaded successfully:', driveFile.name);
        } else {
          console.error('[MessageInput] Upload failed:', result);
          alert(`Failed to upload ${file.name}: ${result.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('[MessageInput] Upload error:', error);
        alert(`Error uploading ${file.name}`);
      }
    }

    setIsUploading(false);
    setUploadProgress('');

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Editing Indicator */}
      {editingMessage && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-primary bg-primary/10 p-2">
          <div className="flex items-center gap-2">
            <Edit className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Editing message</span>
          </div>
          <button
            onClick={handleCancel}
            className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Re-auth Prompt */}
      {requiresReauth && (
        <DriveReauthPrompt
          onReauth={handleReauth}
          onDismiss={dismissReauth}
          variant="inline"
        />
      )}

      {/* Error Display with Retry */}
      {pickerError && !requiresReauth && (
        <div className="mb-2 rounded-md border border-destructive bg-destructive/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-destructive">{pickerError}</span>
            {pickerError.includes('not loaded') && (
              <button
                onClick={retryLoad}
                className="ml-3 rounded bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/30"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && uploadProgress && (
        <div className="mb-2 rounded-md border border-primary bg-primary/10 p-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-primary">{uploadProgress}</span>
          </div>
        </div>
      )}

      {/* Selected Files Display */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5"
            >
              {file.iconUrl && (
                <img src={file.iconUrl} alt="" className="h-4 w-4" />
              )}
              <span className="text-sm">{file.name}</span>
              <button
                onClick={() => handleRemoveFile(file.id)}
                className="ml-1 rounded hover:bg-accent"
                title="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-start gap-2">
        <div className="relative flex-1">
          <MentionInputV2
            value={message}
            onChange={setMessage}
            onSubmit={handleSend}
            conversationId={conversationId}
            disabled={sendMessage.isPending}
          />
          {/* Emoji picker - Desktop only (mobile keyboards have built-in emoji) */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="hidden md:block absolute top-1/2 -translate-y-1/2 right-2 rounded p-1 hover:bg-accent"
            style={{ marginTop: '-12px' }}
          >
            <Smile className="h-5 w-5 text-muted-foreground" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 right-0 z-10">
              <EmojiPicker
                onEmojiClick={(emoji) => {
                  setMessage((prev) => prev + emoji.emoji);
                  setShowEmojiPicker(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Attach Button with Dropdown Menu */}
        <div className="relative" style={{ marginTop: '5px' }} ref={attachMenuRef}>
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={sendMessage.isPending || isUploading}
            className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            title="Attach files"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Dropdown Menu */}
          {showAttachMenu && (
            <div className="absolute bottom-full mb-2 right-0 z-50 min-w-[200px] rounded-md border border-border bg-popover shadow-lg">
              <div className="p-1">
                <button
                  onClick={handleGoogleDriveClick}
                  disabled={!isLoaded}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-left hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <HardDrive className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Google Drive</div>
                    <div className="text-xs text-muted-foreground">Attach from Drive</div>
                  </div>
                </button>
                <button
                  onClick={handleLocalFileClick}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-left hover:bg-accent"
                >
                  <Upload className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Local Files</div>
                    <div className="text-xs text-muted-foreground">Upload from device</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Hidden file input for local files */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleLocalFileChange}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={(!message.trim() && selectedFiles.length === 0) || sendMessage.isPending || isUploading}
          className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          style={{ marginTop: '5px' }}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
