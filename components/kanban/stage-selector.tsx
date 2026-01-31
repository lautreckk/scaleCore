"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Board {
  id: string;
  name: string;
  kanban_stages: Stage[];
}

interface StageSelectorProps {
  itemType: "chat" | "lead";
  itemId: string;
  currentStageId: string | null;
  currentBoardId: string | null;
  onStageChange?: (stageId: string, boardId: string) => void;
  compact?: boolean;
}

export function StageSelector({
  itemType,
  itemId,
  currentStageId,
  currentBoardId,
  onStageChange,
  compact = false,
}: StageSelectorProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const response = await fetch("/api/kanban/boards");
      if (response.ok) {
        const data = await response.json();
        // Filter boards that accept this item type
        const filteredBoards = data.filter(
          (board: { entity_type: string }) =>
            board.entity_type === itemType + "s" ||
            board.entity_type === "both"
        );
        setBoards(filteredBoards);
      }
    } catch (error) {
      console.error("Error loading boards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (stageId: string) => {
    if (updating) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/kanban/items/${itemType}/${itemId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar etapa");
      }

      const data = await response.json();
      onStageChange?.(stageId, data.board_id);
      toast.success("Etapa atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar etapa");
    } finally {
      setUpdating(false);
    }
  };

  // Find current stage info
  const currentStage = boards
    .flatMap((b) => b.kanban_stages)
    .find((s) => s.id === currentStageId);

  if (loading) {
    return (
      <div className="h-8 w-32 bg-surface-elevated animate-pulse rounded" />
    );
  }

  if (boards.length === 0) {
    return null;
  }

  return (
    <Select
      value={currentStageId || ""}
      onValueChange={handleStageChange}
      disabled={updating}
    >
      <SelectTrigger className={compact ? "h-7 text-xs w-auto min-w-[120px]" : ""}>
        <SelectValue placeholder="Selecionar etapa">
          {currentStage && (
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: currentStage.color }}
              />
              <span className="truncate">{currentStage.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {boards.map((board) => (
          <div key={board.id}>
            {boards.length > 1 && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {board.name}
              </div>
            )}
            {board.kanban_stages
              .sort((a, b) => a.position - b.position)
              .map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
