"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  title: string;
  is_completed: boolean;
  position: number;
}

interface TaskChecklistProps {
  taskId: string;
  items: ChecklistItem[];
  onUpdate: () => void;
}

export function TaskChecklist({
  taskId,
  items,
  onUpdate,
}: TaskChecklistProps) {
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const completedCount = items.filter((i) => i.is_completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleAddItem = async () => {
    if (!newItem.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/tarefas/tasks/${taskId}/checklists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newItem.trim() }),
      });

      if (!response.ok) throw new Error("Erro ao adicionar item");

      setNewItem("");
      onUpdate();
    } catch (error) {
      toast.error("Erro ao adicionar item");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (item: ChecklistItem) => {
    setUpdatingId(item.id);
    try {
      const response = await fetch(`/api/tarefas/tasks/${taskId}/checklists`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist_id: item.id,
          is_completed: !item.is_completed,
        }),
      });

      if (!response.ok) throw new Error("Erro ao atualizar item");
      onUpdate();
    } catch (error) {
      toast.error("Erro ao atualizar item");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const response = await fetch(
        `/api/tarefas/tasks/${taskId}/checklists?checklist_id=${itemId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Erro ao remover item");
      onUpdate();
    } catch (error) {
      toast.error("Erro ao remover item");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">
          Checklist ({completedCount}/{items.length})
        </h4>
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              progress === 100 ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 group"
          >
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={() => handleToggle(item)}
              disabled={updatingId === item.id}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                item.is_completed && "line-through text-muted-foreground"
              )}
            >
              {item.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDelete(item.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex items-center gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Adicionar item..."
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          disabled={loading}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={loading || !newItem.trim()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
