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
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { KanbanCard, KanbanCardItem } from "./kanban-card";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  items: KanbanCardItem[];
}

interface KanbanColumnProps {
  stage: Stage;
  onEdit: () => void;
  onDelete: () => void;
  onSelectItem: (item: KanbanCardItem) => void;
}

export function KanbanColumn({
  stage,
  onEdit,
  onDelete,
  onSelectItem,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
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
        style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white">{stage.name}</h3>
          <span className="text-xs text-muted-foreground bg-surface-elevated px-2 py-0.5 rounded-full">
            {stage.items.length}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1 p-2">
        <SortableContext
          items={stage.items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {stage.items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                onClick={() => onSelectItem(item)}
              />
            ))}
          </div>
        </SortableContext>

        {stage.items.length === 0 && (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            Arraste items para ca
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
