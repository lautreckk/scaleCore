"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, User, Clock } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

export interface KanbanCardItem {
  id: string;
  type: "chat" | "lead";
  // Chat fields
  remote_jid?: string;
  contact_name?: string | null;
  profile_picture_url?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  stage_id?: string | null;
  tags?: string[] | null;
  whatsapp_instances?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  // Lead fields
  name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string;
}

interface KanbanCardProps {
  item: KanbanCardItem;
  isDragging?: boolean;
  onClick?: () => void;
}

export function KanbanCard({ item, isDragging, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isChat = item.type === "chat";
  const displayName = isChat
    ? item.contact_name || formatPhoneNumber(item.remote_jid || "")
    : item.name || "Sem nome";

  const subtitle = isChat
    ? item.last_message || "Sem mensagens"
    : item.email || item.phone || "";

  const timestamp = isChat
    ? item.last_message_at
    : item.created_at;

  function formatPhoneNumber(jid: string) {
    const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    if (phone.length === 13 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing hover:border-primary transition-colors",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {isChat && item.profile_picture_url ? (
            <img
              src={item.profile_picture_url}
              alt={displayName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-white font-medium",
                isChat ? "bg-green-600" : "bg-primary"
              )}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          {isChat && item.whatsapp_instances?.color && (
            <div
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
              style={{ backgroundColor: item.whatsapp_instances.color }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-white truncate">{displayName}</h4>
            {isChat && item.unread_count && item.unread_count > 0 && (
              <Badge className="bg-primary text-white h-5 min-w-[20px] px-1.5">
                {item.unread_count}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {subtitle}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {isChat ? (
                <>
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Chat
                </>
              ) : (
                <>
                  <User className="h-3 w-3 mr-1" />
                  Lead
                </>
              )}
            </Badge>

            {timestamp && (
              <span className="text-xs text-muted-foreground flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {formatRelativeTime(timestamp)}
              </span>
            )}
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-1.5 py-0"
                >
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
