"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChatLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  panel?: ReactNode;
  showPanel?: boolean;
}

export function ChatLayout({ sidebar, main, panel, showPanel = true }: ChatLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-120px)] bg-card rounded-lg border border-border overflow-hidden">
      {/* Left Sidebar - Chat List */}
      <div className="w-[320px] min-w-[320px] border-r border-border flex flex-col bg-background">
        {sidebar}
      </div>

      {/* Center - Chat Window */}
      <div className="flex-1 flex flex-col min-w-0">
        {main}
      </div>

      {/* Right Panel - Contact Details */}
      {showPanel && panel && (
        <div className={cn(
          "w-[320px] min-w-[320px] border-l border-border flex flex-col bg-background",
          "hidden xl:flex"
        )}>
          {panel}
        </div>
      )}
    </div>
  );
}
