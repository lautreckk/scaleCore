"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck, Clock, FileText, Download } from "lucide-react";

interface MessageBubbleProps {
  content: string | null;
  messageType: string;
  mediaUrl: string | null;
  fromMe: boolean;
  status: string;
  timestamp: string;
}

export function MessageBubble({
  content,
  messageType,
  mediaUrl,
  fromMe,
  status,
  timestamp,
}: MessageBubbleProps) {
  const formatMessageTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = () => {
    switch (status) {
      case "sending":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const renderMedia = () => {
    if (!mediaUrl) return null;

    switch (messageType) {
      case "image":
        return (
          <img
            src={mediaUrl}
            alt="Image"
            className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(mediaUrl, "_blank")}
          />
        );
      case "video":
        return (
          <video
            src={mediaUrl}
            controls
            className="max-w-full rounded-lg mb-2"
            preload="metadata"
          />
        );
      case "audio":
        return (
          <audio src={mediaUrl} controls className="w-full mb-2" preload="metadata" />
        );
      case "document":
        return (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-2 hover:bg-muted transition-colors"
          >
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {content || "Documento"}
              </p>
              <p className="text-xs text-muted-foreground">Clique para abrir</p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn("flex", fromMe ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-4 py-2 shadow-sm",
          fromMe
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-card border border-border rounded-bl-none"
        )}
      >
        {renderMedia()}

        {/* Show content for text messages or as caption for media */}
        {content && (messageType === "text" || messageType === "image" || messageType === "video") && (
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-sm",
              fromMe ? "text-white" : "text-white"
            )}
          >
            {content}
          </p>
        )}

        {/* Timestamp and status */}
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            fromMe ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {formatMessageTime(timestamp)}
          </span>
          {fromMe && getStatusIcon()}
        </div>
      </div>
    </div>
  );
}
