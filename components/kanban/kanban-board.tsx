"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Settings, ArrowLeft, Loader2 } from "lucide-react";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard, KanbanCardItem } from "./kanban-card";
import { KanbanSidePanel } from "./kanban-side-panel";
import { StageDialog } from "./stage-dialog";
import { BoardSettingsDialog } from "./board-settings-dialog";
import Link from "next/link";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  items: KanbanCardItem[];
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  entity_type: string;
  filters: Record<string, unknown>;
  is_default: boolean;
  kanban_stages: Stage[];
}

interface KanbanBoardProps {
  boardId: string;
}

export function KanbanBoard({ boardId }: KanbanBoardProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<KanbanCardItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<KanbanCardItem | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const loadBoard = useCallback(async () => {
    try {
      const response = await fetch(`/api/kanban/boards/${boardId}`);
      if (response.ok) {
        const data = await response.json();
        setBoard(data);
      } else {
        toast.error("Erro ao carregar board");
      }
    } catch (error) {
      console.error("Error loading board:", error);
      toast.error("Erro ao carregar board");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    loadBoard();

    // Set up real-time subscription for chats
    const chatsChannel = supabase
      .channel(`kanban-chats-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          loadBoard();
        }
      )
      .subscribe();

    // Set up real-time subscription for leads
    const leadsChannel = supabase
      .channel(`kanban-leads-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          loadBoard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatsChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, [boardId, loadBoard, supabase]);

  const findItemStage = (itemId: string): string | null => {
    if (!board) return null;
    for (const stage of board.kanban_stages) {
      if (stage.items.some((item) => item.id === itemId)) {
        return stage.id;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const itemId = active.id as string;

    if (!board) return;

    for (const stage of board.kanban_stages) {
      const item = stage.items.find((i) => i.id === itemId);
      if (item) {
        setActiveItem(item);
        break;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeStageId = findItemStage(activeId);
    let overStageId = findItemStage(overId);

    // If over is a stage (column), use that stage id
    if (!overStageId && board.kanban_stages.some((s) => s.id === overId)) {
      overStageId = overId;
    }

    if (!activeStageId || !overStageId || activeStageId === overStageId) {
      return;
    }

    // Move item between stages optimistically
    setBoard((prev) => {
      if (!prev) return prev;

      const activeStage = prev.kanban_stages.find((s) => s.id === activeStageId);
      const overStage = prev.kanban_stages.find((s) => s.id === overStageId);

      if (!activeStage || !overStage) return prev;

      const activeItem = activeStage.items.find((i) => i.id === activeId);
      if (!activeItem) return prev;

      return {
        ...prev,
        kanban_stages: prev.kanban_stages.map((stage) => {
          if (stage.id === activeStageId) {
            return {
              ...stage,
              items: stage.items.filter((i) => i.id !== activeId),
            };
          }
          if (stage.id === overStageId) {
            return {
              ...stage,
              items: [...stage.items, { ...activeItem, stage_id: overStageId }],
            };
          }
          return stage;
        }),
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which stage the item ended up in
    let targetStageId: string | null = null;

    // Check if dropped on a stage
    if (board.kanban_stages.some((s) => s.id === overId)) {
      targetStageId = overId;
    } else {
      // Find stage containing the item
      targetStageId = findItemStage(activeId);
    }

    if (!targetStageId) return;

    // Find the item
    let itemType = "chat";
    for (const stage of board.kanban_stages) {
      const item = stage.items.find((i) => i.id === activeId);
      if (item) {
        itemType = item.type;
        break;
      }
    }

    // Call API to persist the move
    try {
      const response = await fetch(`/api/kanban/items/${itemType}/${activeId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageId: targetStageId,
        }),
      });

      if (!response.ok) {
        toast.error("Erro ao mover item");
        loadBoard(); // Revert to server state
      }
    } catch (error) {
      console.error("Error moving item:", error);
      toast.error("Erro ao mover item");
      loadBoard(); // Revert to server state
    }
  };

  const handleCreateStage = async (name: string, color: string) => {
    try {
      const response = await fetch(`/api/kanban/boards/${boardId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar etapa");
      }

      toast.success("Etapa criada com sucesso");
      loadBoard();
      setStageDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao criar etapa");
    }
  };

  const handleUpdateStage = async (stageId: string, name: string, color: string) => {
    try {
      const response = await fetch(`/api/kanban/boards/${boardId}/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar etapa");
      }

      toast.success("Etapa atualizada");
      loadBoard();
      setEditingStage(null);
      setStageDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao atualizar etapa");
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta etapa? Os items serao movidos para a primeira etapa.")) {
      return;
    }

    try {
      const response = await fetch(`/api/kanban/boards/${boardId}/stages/${stageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir etapa");
      }

      toast.success("Etapa excluida");
      loadBoard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir etapa");
    }
  };

  const handleEditStage = (stage: Stage) => {
    setEditingStage(stage);
    setStageDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <p className="text-muted-foreground">Board nao encontrado</p>
        <Link href="/kanban">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link href="/kanban">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{board.name}</h1>
            {board.description && (
              <p className="text-sm text-muted-foreground">{board.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingStage(null);
              setStageDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Etapa
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            <SortableContext
              items={board.kanban_stages.map((s) => s.id)}
              strategy={horizontalListSortingStrategy}
            >
              {board.kanban_stages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  onEdit={() => handleEditStage(stage)}
                  onDelete={() => handleDeleteStage(stage.id)}
                  onSelectItem={setSelectedItem}
                />
              ))}
            </SortableContext>
          </div>

          <DragOverlay>
            {activeItem && (
              <KanbanCard item={activeItem} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Side Panel */}
      {selectedItem && (
        <KanbanSidePanel
          item={selectedItem}
          stages={board.kanban_stages}
          onClose={() => setSelectedItem(null)}
          onStageChange={(stageId) => {
            // Update item stage
            fetch(`/api/kanban/items/${selectedItem.type}/${selectedItem.id}/move`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stageId }),
            }).then(() => {
              loadBoard();
            });
          }}
        />
      )}

      {/* Dialogs */}
      <StageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        stage={editingStage}
        onSave={(name, color) => {
          if (editingStage) {
            handleUpdateStage(editingStage.id, name, color);
          } else {
            handleCreateStage(name, color);
          }
        }}
      />

      <BoardSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        board={board}
        onSave={() => {
          loadBoard();
          setSettingsDialogOpen(false);
        }}
      />
    </div>
  );
}
