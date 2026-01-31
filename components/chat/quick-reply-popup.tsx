"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Mic,
  Video,
  Loader2,
} from "lucide-react";

export interface QuickReply {
  id: string;
  name: string;
  shortcut: string | null;
  category: string | null;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  file_name: string | null;
  usage_count: number;
}

interface QuickReplyPopupProps {
  isOpen: boolean;
  searchQuery: string;
  onSelect: (reply: QuickReply) => void;
  onClose: () => void;
}

const categories: Record<string, string> = {
  saudacao: "Saudacao",
  atendimento: "Atendimento",
  informacao: "Informacao",
  vendas: "Vendas",
  encerramento: "Encerramento",
  outros: "Outros",
};

const getMessageTypeIcon = (type: string) => {
  switch (type) {
    case "image":
      return ImageIcon;
    case "document":
      return FileText;
    case "audio":
      return Mic;
    case "video":
      return Video;
    default:
      return MessageSquare;
  }
};

export function QuickReplyPopup({
  isOpen,
  searchQuery,
  onSelect,
  onClose,
}: QuickReplyPopupProps) {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Load quick replies
  useEffect(() => {
    if (isOpen) {
      loadQuickReplies();
    }
  }, [isOpen]);

  const loadQuickReplies = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/quick-replies?active=true");
      if (response.ok) {
        const data = await response.json();
        setQuickReplies(data);
      }
    } catch (error) {
      console.error("Error loading quick replies:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter replies based on search
  const filteredReplies = quickReplies.filter((reply) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      reply.name.toLowerCase().includes(query) ||
      reply.shortcut?.toLowerCase().includes(query) ||
      reply.content?.toLowerCase().includes(query)
    );
  });

  // Group by category
  const groupedReplies = filteredReplies.reduce((acc, reply) => {
    const cat = reply.category || "outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(reply);
    return acc;
  }, {} as Record<string, QuickReply[]>);

  // Flatten for keyboard navigation
  const flatReplies = Object.values(groupedReplies).flat();

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || flatReplies.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatReplies.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatReplies.length) % flatReplies.length);
          break;
        case "Enter":
          e.preventDefault();
          if (flatReplies[selectedIndex]) {
            handleSelect(flatReplies[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, flatReplies, selectedIndex, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleSelect = async (reply: QuickReply) => {
    // Increment usage count in background
    fetch(`/api/quick-replies/${reply.id}/use`, { method: "POST" }).catch(console.error);
    onSelect(reply);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-hidden z-50"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : flatReplies.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground text-sm">
          {quickReplies.length === 0
            ? "Nenhuma mensagem rapida configurada"
            : "Nenhuma mensagem encontrada"}
        </div>
      ) : (
        <div className="overflow-y-auto max-h-80">
          {Object.entries(groupedReplies).map(([category, replies]) => (
            <div key={category}>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                {categories[category] || category}
              </div>
              {replies.map((reply) => {
                const globalIndex = flatReplies.findIndex((r) => r.id === reply.id);
                const TypeIcon = getMessageTypeIcon(reply.message_type);
                const isSelected = globalIndex === selectedIndex;

                return (
                  <button
                    key={reply.id}
                    ref={(el) => {
                      itemRefs.current[globalIndex] = el;
                    }}
                    onClick={() => handleSelect(reply)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={cn(
                      "w-full px-3 py-2 flex items-center gap-3 text-left transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{reply.name}</span>
                        {reply.shortcut && (
                          <span className="text-xs text-muted-foreground font-mono">
                            /{reply.shortcut}
                          </span>
                        )}
                      </div>
                      {reply.message_type === "text" && reply.content && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {reply.content}
                        </p>
                      )}
                      {reply.message_type !== "text" && reply.file_name && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {reply.file_name}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
        <span className="mr-3">↑↓ navegar</span>
        <span className="mr-3">Enter selecionar</span>
        <span>Esc fechar</span>
      </div>
    </div>
  );
}
