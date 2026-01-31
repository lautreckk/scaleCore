"use client";

import { useState } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { CheckCircle, UserCircle } from "lucide-react";

interface ChatListItemProps {
  id: string;
  contactName: string | null;
  profilePictureUrl: string | null;
  remoteJid: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  instanceName: string | null;
  instanceColor: string | null;
  leadName: string | null;
  isSelected: boolean;
  onClick: () => void;
  status?: string | null;
  isAssigned?: boolean;
}

export function ChatListItem({
  contactName,
  profilePictureUrl,
  remoteJid,
  lastMessage,
  lastMessageAt,
  unreadCount,
  instanceName,
  instanceColor,
  leadName,
  isSelected,
  onClick,
  status,
  isAssigned,
}: ChatListItemProps) {
  const formatPhoneNumber = (jid: string) => {
    const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    if (phone.length === 13 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  const displayName = contactName || leadName || formatPhoneNumber(remoteJid);
  const initial = displayName.charAt(0).toUpperCase();
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/10 hover:bg-primary/10",
        unreadCount > 0 && "bg-muted/30"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {profilePictureUrl && !imageError ? (
          <img
            src={profilePictureUrl}
            alt={displayName}
            className="h-12 w-12 rounded-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center text-white font-medium">
            {initial}
          </div>
        )}
        {instanceColor && (
          <div
            className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background"
            style={{ backgroundColor: instanceColor }}
            title={instanceName || undefined}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-white truncate">{displayName}</span>
            {/* Show phone number when there's a contact name */}
            {(contactName || leadName) && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                {formatPhoneNumber(remoteJid).slice(-9)}
              </span>
            )}
          </div>
          {lastMessageAt && (
            <span className={cn(
              "text-xs flex-shrink-0",
              unreadCount > 0 ? "text-primary" : "text-muted-foreground"
            )}>
              {formatRelativeTime(lastMessageAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Status indicators */}
            {status === "closed" && (
              <span title="Finalizado">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              </span>
            )}
            {isAssigned && status !== "closed" && (
              <span title="Atribuído">
                <UserCircle className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              </span>
            )}
            <span className="text-sm text-muted-foreground truncate">
              {lastMessage || "Sem mensagens"}
            </span>
          </div>
          {unreadCount > 0 && (
            <span className="h-5 min-w-[20px] rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center px-1.5 flex-shrink-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
