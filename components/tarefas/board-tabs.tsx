"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TaskBoard {
  id: string;
  name: string;
  color: string;
  description: string | null;
  visibility?: string;
  department_id?: string | null;
}

interface BoardTabsProps {
  boards: TaskBoard[];
  activeBoard: string | null;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
  onEditBoard: (board: TaskBoard) => void;
  onDeleteBoard: (boardId: string) => void;
}

export function BoardTabs({
  boards,
  activeBoard,
  onSelectBoard,
  onCreateBoard,
  onEditBoard,
  onDeleteBoard,
}: BoardTabsProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <ScrollArea className="flex-1">
        <div className="flex items-center gap-1">
          {boards.map((board) => (
            <div key={board.id} className="relative group">
              <button
                onClick={() => onSelectBoard(board.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  activeBoard === board.id
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-surface-elevated hover:text-white"
                )}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: board.color }}
                />
                {board.name}
              </button>
              {activeBoard === board.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditBoard(board)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteBoard(board.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <Button
        variant="outline"
        size="sm"
        onClick={onCreateBoard}
        className="flex-shrink-0"
      >
        <Plus className="h-4 w-4 mr-1" />
        Novo Board
      </Button>
    </div>
  );
}
