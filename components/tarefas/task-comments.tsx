"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Send, Loader2, Trash2 } from "lucide-react";
import { formatRelativeTime, getInitials } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface TaskCommentsProps {
  taskId: string;
  comments: Comment[];
  currentUserId: string;
  onUpdate: () => void;
}

export function TaskComments({
  taskId,
  comments,
  currentUserId,
  onUpdate,
}: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/tarefas/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (!response.ok) throw new Error("Erro ao adicionar comentário");

      setNewComment("");
      onUpdate();
    } catch (error) {
      toast.error("Erro ao adicionar comentário");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const response = await fetch(
        `/api/tarefas/tasks/${taskId}/comments?comment_id=${commentId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Erro ao remover comentário");
      onUpdate();
    } catch (error) {
      toast.error("Erro ao remover comentário");
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-white">
        Comentários ({comments.length})
      </h4>

      {/* New comment */}
      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Adicione um comentário..."
          className="min-h-[60px] text-sm"
          disabled={loading}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleSubmit}
          disabled={loading || !newComment.trim()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Comments list */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 group">
            <Avatar className="h-8 w-8">
              <AvatarImage src={comment.user.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(comment.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {comment.user.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(comment.created_at)}
                </span>
                {comment.user.id === currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum comentário ainda
          </p>
        )}
      </div>
    </div>
  );
}
