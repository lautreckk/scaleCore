"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from "lucide-react";

interface ChatLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  panel?: ReactNode;
  showPanel?: boolean;
  showSidebar?: boolean;
  selectedChatId?: string | null;
  onBackToList?: () => void;
  onToggleSidebar?: () => void;
  onTogglePanel?: () => void;
}

export function ChatLayout({
  sidebar,
  main,
  panel,
  showPanel = true,
  showSidebar = true,
  selectedChatId,
  onBackToList,
  onToggleSidebar,
  onTogglePanel,
}: ChatLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-120px)] bg-card rounded-lg border border-border overflow-hidden relative">
      {/* Left Sidebar - Chat List */}
      <div
        className={cn(
          "flex-shrink-0 border-r border-border flex flex-col bg-background overflow-hidden transition-all duration-300",
          // Full width on mobile when no chat selected, fixed width on desktop
          selectedChatId ? "hidden md:flex" : "flex",
          showSidebar ? "w-full md:w-[300px] lg:w-[320px]" : "w-0 md:w-0 border-r-0"
        )}
      >
        {showSidebar && sidebar}
      </div>

      {/* Center - Chat Window */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden relative",
          // On mobile, show chat window only when a chat is selected
          !selectedChatId ? "hidden md:flex" : "flex"
        )}
      >
        {/* Toolbar */}
        <div className="absolute top-3 left-2 z-20 flex items-center gap-1">
          {/* Mobile back button */}
          {selectedChatId && onBackToList && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToList}
              className="md:hidden h-8 w-8 bg-background/80 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Toggle sidebar button - desktop only */}
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="hidden md:flex h-8 w-8 bg-background/80 backdrop-blur-sm"
              title={showSidebar ? "Esconder conversas" : "Mostrar conversas"}
            >
              {showSidebar ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Toggle panel button - top right */}
        {onTogglePanel && panel && (
          <div className="absolute top-3 right-2 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={onTogglePanel}
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              title={showPanel ? "Esconder detalhes" : "Mostrar detalhes"}
            >
              {showPanel ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {main}
      </div>

      {/* Right Panel - Contact Details */}
      {panel && (
        <div
          className={cn(
            "flex-shrink-0 border-l border-border flex flex-col bg-background overflow-hidden transition-all duration-300",
            showPanel ? "w-[300px] lg:w-[320px]" : "w-0 border-l-0",
            "hidden md:flex"
          )}
        >
          {showPanel && panel}
        </div>
      )}
    </div>
  );
}
