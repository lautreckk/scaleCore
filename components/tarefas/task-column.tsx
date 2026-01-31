"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Plus } from "lucide-react";
import { TaskCard, TaskItem } from "./task-card";
import { cn } from "@/lib/utils";

interface TaskColumnData {
  id: string;
  name: string;
  color: string;
  position: number;
  tasks: TaskItem[];
}

interface TaskColumnProps {
  column: TaskColumnData;
  onEdit: () => void;
  onDelete: () => void;
  onSelectTask: (task: TaskItem) => void;
  onAddTask: () => void;
}

export function TaskColumn({
  column,
  onEdit,
  onDelete,
  onSelectTask,
  onAddTask,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-[300px] bg-surface rounded-lg flex flex-col h-full",
        isOver && "ring-2 ring-primary"
      )}
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between p-3 border-b border-border"
        style={{ borderTopColor: column.color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white">{column.name}</h3>
          <span className="text-xs text-muted-foreground bg-surface-elevated px-2 py-0.5 rounded-full">
            {column.tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onAddTask}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Coluna
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1 p-2">
        <SortableContext
          items={column.tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {column.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onSelectTask(task)}
              />
            ))}
          </div>
        </SortableContext>

        {column.tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm">
            <p>Sem tarefas</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={onAddTask}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
