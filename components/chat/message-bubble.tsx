"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  Download,
  Image as ImageIcon,
  Play,
  Pause,
  Mic,
  MoreVertical,
  Copy,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

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
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatMessageTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioProgress(audioRef.current.currentTime);
  };

  const handleAudioLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * audioDuration;
    setAudioProgress(audioRef.current.currentTime);
  };

  const handleCopyText = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success("Texto copiado!");
    }
  };

  const handleDownload = async () => {
    if (!mediaUrl) return;
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = mediaUrl.split(".").pop()?.split("?")[0] || "file";
      a.download = `download.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
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
    if (!mediaUrl) {
      // Show placeholder for media types without URL
      if (messageType === "image") {
        return (
          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg mb-2">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Imagem</span>
          </div>
        );
      }
      if (messageType === "video") {
        return (
          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg mb-2">
            <Play className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Video</span>
          </div>
        );
      }
      if (messageType === "audio") {
        return (
          <div className="flex items-center gap-3 p-2 min-w-[200px]">
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
              fromMe
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              <Play className="h-5 w-5 ml-0.5" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <div className={cn(
                "h-1 rounded-full",
                fromMe ? "bg-primary-foreground/30" : "bg-muted"
              )} />
              <span className={cn(
                "text-[10px]",
                fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                0:00
              </span>
            </div>
          </div>
        );
      }
      return null;
    }

    switch (messageType) {
      case "image":
      case "sticker":
        if (imageError) {
          return (
            <div
              className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg mb-2 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => window.open(mediaUrl, "_blank")}
            >
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Imagem (clique para abrir)
              </span>
            </div>
          );
        }
        return (
          <img
            src={mediaUrl}
            alt="Image"
            className={cn(
              "rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity object-cover",
              messageType === "sticker" ? "max-w-[150px]" : "max-w-[280px] max-h-[280px]"
            )}
            onClick={() => setShowImageModal(true)}
            onError={() => setImageError(true)}
          />
        );
      case "video":
        if (videoError) {
          return (
            <div
              className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg mb-2 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => window.open(mediaUrl, "_blank")}
            >
              <Play className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Video (clique para abrir)
              </span>
            </div>
          );
        }
        return (
          <video
            src={mediaUrl}
            controls
            className="max-w-[280px] rounded-lg mb-2"
            preload="metadata"
            onError={() => setVideoError(true)}
          />
        );
      case "audio":
        if (audioError) {
          return (
            <div
              className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg mb-2 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => window.open(mediaUrl, "_blank")}
            >
              <Mic className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Audio (clique para abrir)
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-3 p-2 min-w-[200px]">
            <audio
              ref={audioRef}
              src={mediaUrl}
              preload="metadata"
              onError={() => setAudioError(true)}
              onTimeUpdate={handleAudioTimeUpdate}
              onLoadedMetadata={handleAudioLoadedMetadata}
              onEnded={handleAudioEnded}
              className="hidden"
            />
            <button
              onClick={toggleAudio}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                fromMe
                  ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                  : "bg-primary/20 hover:bg-primary/30 text-primary"
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>
            <div className="flex-1 flex flex-col gap-1">
              <div
                className={cn(
                  "h-1 rounded-full cursor-pointer relative",
                  fromMe ? "bg-primary-foreground/30" : "bg-muted"
                )}
                onClick={handleProgressClick}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    fromMe ? "bg-primary-foreground" : "bg-primary"
                  )}
                  style={{ width: `${audioDuration ? (audioProgress / audioDuration) * 100 : 0}%` }}
                />
              </div>
              <span className={cn(
                "text-[10px]",
                fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {formatAudioTime(isPlaying ? audioProgress : audioDuration || 0)}
              </span>
            </div>
          </div>
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

  const hasMedia = mediaUrl && ["image", "video", "audio", "document", "sticker"].includes(messageType);
  const hasText = content && messageType === "text";

  return (
    <>
      {/* Image Modal */}
      {showImageModal && mediaUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Download className="h-6 w-6 text-white" />
          </button>
          <img
            src={mediaUrl}
            alt="Image"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div
        className={cn("flex w-full group", fromMe ? "justify-end" : "justify-start")}
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        {/* Menu for sent messages (left side) */}
        {fromMe && (
          <div className={cn(
            "flex items-start mr-1 transition-opacity",
            showMenu ? "opacity-100" : "opacity-0"
          )}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {hasText && (
                  <DropdownMenuItem onClick={handleCopyText}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar texto
                  </DropdownMenuItem>
                )}
                {hasMedia && (
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div
          className={cn(
            "max-w-[75%] sm:max-w-[70%] rounded-lg px-3 py-2 shadow-sm break-words relative",
            fromMe
              ? "bg-primary text-primary-foreground rounded-br-none"
              : "bg-card border border-border rounded-bl-none"
          )}
        >
          {renderMedia()}

          {/* Show content for text messages or as caption for media */}
          {content && messageType !== "document" && messageType !== "audio" && (
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

        {/* Menu for received messages (right side) */}
        {!fromMe && (
          <div className={cn(
            "flex items-start ml-1 transition-opacity",
            showMenu ? "opacity-100" : "opacity-0"
          )}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                {hasText && (
                  <DropdownMenuItem onClick={handleCopyText}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar texto
                  </DropdownMenuItem>
                )}
                {hasMedia && (
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </>
  );
}
