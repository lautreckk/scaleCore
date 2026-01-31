"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  X,
  Calendar,
  User,
  Building2,
  Flag,
  Tag,
  Loader2,
  Trash2,
  Check,
} from "lucide-react";
import { TaskChecklist } from "./task-checklist";
import { TaskComments } from "./task-comments";
import { getInitials, cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  labels: string[];
  due_date: string | null;
  cover_color: string | null;
  completed_at: string | null;
  column_id: string;
  assignee: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  department: {
    id: string;
    name: string;
    color: string;
  } | null;
  task_checklists: Array<{
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
  }>;
  task_comments: Array<{
    id: string;
    content: string;
    created_at: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar_url: string | null;
    };
  }>;
}

interface Column {
  id: string;
  name: string;
  color: string;
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

interface TaskDetailPanelProps {
  taskId: string;
  columns: Column[];
  members: TeamMember[];
  departments: Department[];
  currentUserId: string;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#3b82f6",
];

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function TaskDetailPanel({
  taskId,
  columns,
  members,
  departments,
  currentUserId,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailPanelProps) {
  const [task, setTask] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const loadTask = useCallback(async () => {
    try {
      const response = await fetch(`/api/tarefas/tasks/${taskId}`);
      if (!response.ok) throw new Error("Erro ao carregar tarefa");
      const data = await response.json();
      setTask(data);
      setTitle(data.title);
      setDescription(data.description || "");
    } catch (error) {
      toast.error("Erro ao carregar tarefa");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const updateTask = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/tarefas/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Erro ao atualizar tarefa");

      const updatedTask = await response.json();
      setTask((prev) =>
        prev ? { ...prev, ...updatedTask } : null
      );
      onUpdate();
    } catch (error) {
      toast.error("Erro ao atualizar tarefa");
    } finally {
      setSaving(false);
    }
  };

  const handleTitleBlur = () => {
    if (task && title !== task.title && title.trim()) {
      updateTask({ title: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (task && description !== (task.description || "")) {
      updateTask({ description: description.trim() || null });
    }
  };

  const handleAddLabel = () => {
    if (!newLabel.trim() || !task) return;
    const updatedLabels = [...(task.labels || []), newLabel.trim()];
    updateTask({ labels: updatedLabels });
    setNewLabel("");
  };

  const handleRemoveLabel = (label: string) => {
    if (!task) return;
    const updatedLabels = task.labels.filter((l) => l !== label);
    updateTask({ labels: updatedLabels });
  };

  const handleToggleComplete = () => {
    if (!task) return;
    const completed_at = task.completed_at
      ? null
      : new Date().toISOString();
    updateTask({ completed_at });
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/tarefas/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir tarefa");

      toast.success("Tarefa excluída");
      onDelete();
      onClose();
    } catch (error) {
      toast.error("Erro ao excluir tarefa");
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveToColumn = async (columnId: string) => {
    try {
      const response = await fetch(`/api/tarefas/tasks/${taskId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column_id: columnId }),
      });

      if (!response.ok) throw new Error("Erro ao mover tarefa");

      setTask((prev) => (prev ? { ...prev, column_id: columnId } : null));
      onUpdate();
    } catch (error) {
      toast.error("Erro ao mover tarefa");
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[450px] bg-surface border-l border-border z-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="fixed inset-y-0 right-0 w-[450px] bg-surface border-l border-border z-50 flex items-center justify-center">
        <p className="text-muted-foreground">Tarefa não encontrada</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-surface border-l border-border z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant={task.completed_at ? "default" : "outline"}
            size="sm"
            onClick={handleToggleComplete}
            className={cn(
              task.completed_at && "bg-green-600 hover:bg-green-700"
            )}
          >
            <Check className="h-4 w-4 mr-1" />
            {task.completed_at ? "Concluída" : "Concluir"}
          </Button>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Cover color */}
          <div className="space-y-2">
            <Label>Cor da Capa</Label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateTask({ cover_color: null })}
                className={cn(
                  "h-6 w-6 rounded border-2 border-dashed border-muted-foreground",
                  !task.cover_color && "ring-2 ring-white ring-offset-2 ring-offset-surface"
                )}
              />
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateTask({ cover_color: c })}
                  className={cn(
                    "h-6 w-6 rounded",
                    task.cover_color === c &&
                      "ring-2 ring-white ring-offset-2 ring-offset-surface"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-lg font-medium"
            />
          </div>

          {/* Column selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Coluna
            </Label>
            <Select
              value={task.column_id}
              onValueChange={handleMoveToColumn}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      {col.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Prioridade
            </Label>
            <Select
              value={task.priority}
              onValueChange={(value) => updateTask({ priority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data de Entrega
            </Label>
            <Input
              type="date"
              value={task.due_date || ""}
              onChange={(e) =>
                updateTask({ due_date: e.target.value || null })
              }
            />
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Responsável
            </Label>
            <Select
              value={task.assignee?.id || "none"}
              onValueChange={(value) =>
                updateTask({ assignee_id: value === "none" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      {member.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Departamento
            </Label>
            <Select
              value={task.department?.id || "none"}
              onValueChange={(value) =>
                updateTask({ department_id: value === "none" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: dept.color }}
                      />
                      {dept.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Etiquetas
            </Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {task.labels.map((label) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => handleRemoveLabel(label)}
                >
                  {label}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nova etiqueta..."
                className="h-8"
                onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddLabel}
                disabled={!newLabel.trim()}
              >
                Adicionar
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Adicione uma descrição..."
              rows={4}
            />
          </div>

          <Separator />

          {/* Checklist */}
          <TaskChecklist
            taskId={taskId}
            items={task.task_checklists}
            onUpdate={loadTask}
          />

          <Separator />

          {/* Comments */}
          <TaskComments
            taskId={taskId}
            comments={task.task_comments}
            currentUserId={currentUserId}
            onUpdate={loadTask}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
