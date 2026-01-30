"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PanelRightClose, PanelRight } from "lucide-react";

interface ChatLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  panel?: ReactNode;
  showPanel?: boolean;
  selectedChatId?: string | null;
  onBackToList?: () => void;
  onTogglePanel?: () => void;
}

export function ChatLayout({
  sidebar,
  main,
  panel,
  showPanel = false,
  selectedChatId,
  onBackToList,
  onTogglePanel,
}: ChatLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-120px)] bg-card rounded-lg border border-border overflow-hidden relative">
      {/* Left Sidebar - Chat List (always visible) */}
      <div
        className={cn(
          "flex-shrink-0 border-r border-border flex flex-col bg-background overflow-hidden w-full md:w-[300px] lg:w-[320px]",
          // Full width on mobile when no chat selected, fixed width on desktop
          selectedChatId ? "hidden md:flex" : "flex"
        )}
      >
        {sidebar}
      </div>

      {/* Center - Chat Window */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden relative",
          // On mobile, show chat window only when a chat is selected
          !selectedChatId ? "hidden md:flex" : "flex"
        )}
      >
        {/* Mobile back button */}
        {selectedChatId && onBackToList && (
          <div className="absolute top-3 left-2 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToList}
              className="md:hidden h-8 w-8 bg-background/80 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

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
