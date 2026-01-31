"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import { Calendar, CheckSquare, Building2 } from "lucide-react";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  position: number;
  priority: "low" | "medium" | "high" | "urgent";
  labels: string[];
  due_date: string | null;
  cover_color: string | null;
  completed_at: string | null;
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
  task_checklists?: Array<{
    id: string;
    is_completed: boolean;
  }>;
}

interface TaskCardProps {
  task: TaskItem;
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityColors = {
  low: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  urgent: "bg-red-500/10 text-red-400 border-red-500/20",
};

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate checklist progress
  const totalChecklist = task.task_checklists?.length || 0;
  const completedChecklist =
    task.task_checklists?.filter((c) => c.is_completed).length || 0;
  const checklistProgress =
    totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0;

  // Calculate due date status
  const getDueDateStatus = () => {
    if (!task.due_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (task.completed_at) return "completed";
    if (diffDays < 0) return "overdue";
    if (diffDays === 0) return "today";
    if (diffDays <= 2) return "soon";
    return "normal";
  };

  const dueDateStatus = getDueDateStatus();

  const dueDateColors = {
    completed: "text-green-500",
    overdue: "text-red-500",
    today: "text-orange-500",
    soon: "text-yellow-500",
    normal: "text-muted-foreground",
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg rotate-2",
        onClick && "cursor-pointer",
        task.completed_at && "opacity-60"
      )}
      onClick={onClick}
    >
      {/* Cover color */}
      {task.cover_color && (
        <div
          className="h-2 -mx-3 -mt-3 mb-3 rounded-t-lg"
          style={{ backgroundColor: task.cover_color }}
        />
      )}

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className="text-xs px-1.5 py-0"
            >
              {label}
            </Badge>
          ))}
          {task.labels.length > 3 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              +{task.labels.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Title */}
      <h4
        className={cn(
          "font-medium text-white text-sm leading-snug",
          task.completed_at && "line-through"
        )}
      >
        {task.title}
      </h4>

      {/* Meta info */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {/* Priority */}
        <Badge
          variant="outline"
          className={cn("text-xs", priorityColors[task.priority])}
        >
          {priorityLabels[task.priority]}
        </Badge>

        {/* Due date */}
        {task.due_date && dueDateStatus && (
          <span
            className={cn(
              "text-xs flex items-center gap-1",
              dueDateColors[dueDateStatus]
            )}
          >
            <Calendar className="h-3 w-3" />
            {new Date(task.due_date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}

        {/* Checklist progress */}
        {totalChecklist > 0 && (
          <span
            className={cn(
              "text-xs flex items-center gap-1",
              checklistProgress === 100 ? "text-green-500" : "text-muted-foreground"
            )}
          >
            <CheckSquare className="h-3 w-3" />
            {completedChecklist}/{totalChecklist}
          </span>
        )}
      </div>

      {/* Assignee or Department */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {task.assignee ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
          ) : task.department ? (
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: task.department.color,
                color: task.department.color,
              }}
            >
              <Building2 className="h-3 w-3 mr-1" />
              {task.department.name}
            </Badge>
          ) : null}
        </div>

        {/* Checklist progress bar */}
        {totalChecklist > 0 && (
          <div className="w-16 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                checklistProgress === 100 ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${checklistProgress}%` }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
