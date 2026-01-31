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
import { Plus, Loader2, Settings } from "lucide-react";
import { TaskColumn } from "./task-column";
import { TaskCard, TaskItem } from "./task-card";
import { TaskDetailPanel } from "./task-detail-panel";
import { ColumnDialog } from "./column-dialog";
import { CreateTaskDialog } from "./create-task-dialog";
import { CreateBoardDialog } from "./create-board-dialog";

interface Column {
  id: string;
  name: string;
  color: string;
  position: number;
  tasks: TaskItem[];
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  color: string;
  visibility: string;
  department_id: string | null;
  task_columns: Column[];
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface TaskBoardProps {
  boardId: string;
  members: TeamMember[];
  departments: Department[];
  currentUserId: string;
  onBoardUpdate: () => void;
}

export function TaskBoard({
  boardId,
  members,
  departments,
  currentUserId,
  onBoardUpdate,
}: TaskBoardProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Dialogs
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string | undefined>();
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);

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
      const response = await fetch(`/api/tarefas/boards/${boardId}`);
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
    setLoading(true);
    loadBoard();

    // Set up real-time subscription for tasks
    const tasksChannel = supabase
      .channel(`task-board-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          loadBoard();
        }
      )
      .subscribe();

    // Set up real-time subscription for columns
    const columnsChannel = supabase
      .channel(`task-columns-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_columns",
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          loadBoard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(columnsChannel);
    };
  }, [boardId, loadBoard, supabase]);

  const findTaskColumn = (taskId: string): string | null => {
    if (!board) return null;
    for (const column of board.task_columns) {
      if (column.tasks.some((task) => task.id === taskId)) {
        return column.id;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;

    if (!board) return;

    for (const column of board.task_columns) {
      const task = column.tasks.find((t) => t.id === taskId);
      if (task) {
        setActiveTask(task);
        break;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumnId = findTaskColumn(activeId);
    let overColumnId = findTaskColumn(overId);

    // If over is a column, use that column id
    if (!overColumnId && board.task_columns.some((c) => c.id === overId)) {
      overColumnId = overId;
    }

    if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) {
      return;
    }

    // Move task between columns optimistically
    setBoard((prev) => {
      if (!prev) return prev;

      const activeColumn = prev.task_columns.find((c) => c.id === activeColumnId);
      const overColumn = prev.task_columns.find((c) => c.id === overColumnId);

      if (!activeColumn || !overColumn) return prev;

      const activeTaskObj = activeColumn.tasks.find((t) => t.id === activeId);
      if (!activeTaskObj) return prev;

      return {
        ...prev,
        task_columns: prev.task_columns.map((column) => {
          if (column.id === activeColumnId) {
            return {
              ...column,
              tasks: column.tasks.filter((t) => t.id !== activeId),
            };
          }
          if (column.id === overColumnId) {
            return {
              ...column,
              tasks: [...column.tasks, activeTaskObj],
            };
          }
          return column;
        }),
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which column the task ended up in
    let targetColumnId: string | null = null;

    // Check if dropped on a column
    if (board.task_columns.some((c) => c.id === overId)) {
      targetColumnId = overId;
    } else {
      // Find column containing the task
      targetColumnId = findTaskColumn(activeId);
    }

    if (!targetColumnId) return;

    // Call API to persist the move
    try {
      const response = await fetch(`/api/tarefas/tasks/${activeId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column_id: targetColumnId,
        }),
      });

      if (!response.ok) {
        toast.error("Erro ao mover tarefa");
        loadBoard();
      }
    } catch (error) {
      console.error("Error moving task:", error);
      toast.error("Erro ao mover tarefa");
      loadBoard();
    }
  };

  const handleEditColumn = (column: Column) => {
    setEditingColumn(column);
    setColumnDialogOpen(true);
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta coluna? As tarefas serão movidas para a primeira coluna.")) {
      return;
    }

    try {
      const response = await fetch(`/api/tarefas/columns/${columnId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir coluna");
      }

      toast.success("Coluna excluída");
      loadBoard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir coluna");
    }
  };

  const handleAddTask = (columnId: string) => {
    setCreateTaskColumnId(columnId);
    setCreateTaskDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-300px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)]">
        <p className="text-muted-foreground">Board não encontrado</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingColumn(null);
              setColumnDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Coluna
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setBoardSettingsOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
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
              items={board.task_columns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {board.task_columns.map((column) => (
                <TaskColumn
                  key={column.id}
                  column={column}
                  onEdit={() => handleEditColumn(column)}
                  onDelete={() => handleDeleteColumn(column.id)}
                  onSelectTask={(task) => setSelectedTaskId(task.id)}
                  onAddTask={() => handleAddTask(column.id)}
                />
              ))}
            </SortableContext>

            {board.task_columns.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    Nenhuma coluna ainda. Crie a primeira!
                  </p>
                  <Button
                    onClick={() => {
                      setEditingColumn(null);
                      setColumnDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Coluna
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail Panel */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          columns={board.task_columns}
          members={members}
          departments={departments}
          currentUserId={currentUserId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={loadBoard}
          onDelete={loadBoard}
        />
      )}

      {/* Dialogs */}
      <ColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        column={editingColumn}
        boardId={boardId}
        onSave={loadBoard}
      />

      <CreateTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={setCreateTaskDialogOpen}
        boardId={boardId}
        columns={board.task_columns}
        defaultColumnId={createTaskColumnId}
        members={members}
        departments={departments}
        onSave={loadBoard}
      />

      <CreateBoardDialog
        open={boardSettingsOpen}
        onOpenChange={setBoardSettingsOpen}
        board={board}
        departments={departments}
        onSave={() => {
          loadBoard();
          onBoardUpdate();
        }}
      />
    </div>
  );
}
