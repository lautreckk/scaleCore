"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  X,
  Loader2,
  File,
} from "lucide-react";
import { AudioRecorder } from "./audio-recorder";
import { QuickReplyPopup, QuickReply } from "./quick-reply-popup";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSendText: (message: string) => Promise<void>;
  onSendMedia: (file: File, type: "image" | "video" | "audio" | "document") => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSendText,
  onSendMedia,
  onTyping,
  disabled = false,
  placeholder = "Digite uma mensagem...",
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (sending || disabled) return;

    if (selectedFile) {
      setSending(true);
      try {
        const type = getFileType(selectedFile);
        await onSendMedia(selectedFile, type);
        clearFile();
      } catch (error) {
        console.error("Error sending media:", error);
        toast.error("Erro ao enviar arquivo");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!message.trim()) return;

    setSending(true);
    try {
      await onSendText(message.trim());
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't handle Enter if quick replies popup is open (let popup handle it)
    if (showQuickReplies && (e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Escape")) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Detect "/" for quick replies
    const slashMatch = value.match(/\/(\S*)$/);
    if (slashMatch) {
      setQuickReplySearch(slashMatch[1]);
      setShowQuickReplies(true);
    } else if (!value.includes("/")) {
      setShowQuickReplies(false);
      setQuickReplySearch("");
    }

    if (value && onTyping) {
      onTyping();
    }
  };

  const handleQuickReplySelect = async (reply: QuickReply) => {
    setShowQuickReplies(false);
    setQuickReplySearch("");

    if (reply.message_type === "text" && reply.content) {
      // Replace /search with content
      const newMessage = message.replace(/\/\S*$/, reply.content);
      setMessage(newMessage);
      textareaRef.current?.focus();
    } else if (reply.media_url) {
      // Clear the slash from message
      setMessage(message.replace(/\/\S*$/, ""));

      // Send media directly
      setSending(true);
      try {
        // Fetch the media file
        const response = await fetch(reply.media_url);
        const blob = await response.blob();
        const file = new window.File([blob], reply.file_name || "media", {
          type: reply.media_mimetype || "application/octet-stream",
        });

        const type = reply.message_type as "image" | "video" | "audio" | "document";
        await onSendMedia(file, type);
      } catch (error) {
        console.error("Error sending quick reply media:", error);
        toast.error("Erro ao enviar midia");
      } finally {
        setSending(false);
      }
    }
  };

  const getFileType = (file: File): "image" | "video" | "audio" | "document" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, allowedTypes?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 16MB for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Maximo: 16MB");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    // Clear the input so the same file can be selected again
    e.target.value = "";
  };

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 border-t border-border bg-card">
      {/* File Preview */}
      {selectedFile && (
        <div className="mb-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-3">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-20 w-20 object-cover rounded"
              />
            ) : (
              <div className="h-20 w-20 bg-muted rounded flex items-center justify-center">
                <File className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFile}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
          onChange={(e) => handleFileSelect(e)}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
          title="Anexar documento"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        {/* Image Button */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => handleFileSelect(e)}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled || sending}
          title="Enviar imagem ou video"
        >
          <ImageIcon className="h-5 w-5" />
        </Button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <QuickReplyPopup
            isOpen={showQuickReplies}
            searchQuery={quickReplySearch}
            onSelect={handleQuickReplySelect}
            onClose={() => {
              setShowQuickReplies(false);
              setQuickReplySearch("");
            }}
          />
          <Textarea
            ref={textareaRef}
            placeholder={selectedFile ? "Adicione uma legenda..." : placeholder}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || sending}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none py-3",
              "focus-visible:ring-1"
            )}
            rows={1}
          />
        </div>

        {/* Audio Recorder or Send Button */}
        {!message.trim() && !selectedFile ? (
          <AudioRecorder
            onSend={async (blob: Blob) => {
              // Create file from blob
              const audioFile = new window.File([blob], "audio.webm", { type: blob.type });
              await onSendMedia(audioFile, "audio");
            }}
            disabled={disabled}
          />
        ) : (
          <Button
            onClick={handleSend}
            disabled={disabled || sending || (!message.trim() && !selectedFile)}
            size="icon"
            className="h-11 w-11"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
