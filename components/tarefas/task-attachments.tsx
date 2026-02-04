"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, Trash2, Loader2, FileText, Download } from "lucide-react";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

interface TaskAttachmentsProps {
  taskId: string;
  attachments: Attachment[];
  onUpdate: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(fileType: string): boolean {
  return fileType.startsWith("image/");
}

export function TaskAttachments({
  taskId,
  attachments,
  onUpdate,
}: TaskAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Step 1: Upload file to /api/upload
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Erro ao fazer upload");
      }

      const uploadData = await uploadRes.json();

      // Step 2: Save attachment metadata
      const metaRes = await fetch(`/api/tarefas/tasks/${taskId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: uploadData.filename,
          file_url: uploadData.url,
          file_type: uploadData.type,
          file_size: uploadData.size,
        }),
      });

      if (!metaRes.ok) throw new Error("Erro ao salvar anexo");

      onUpdate();
      toast.success("Anexo adicionado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao fazer upload");
    } finally {
      setUploading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Excluir este anexo?")) return;

    setDeletingId(attachmentId);
    try {
      const res = await fetch(
        `/api/tarefas/tasks/${taskId}/attachments?attachment_id=${attachmentId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Erro ao excluir anexo");

      onUpdate();
      toast.success("Anexo excluído");
    } catch (error) {
      toast.error("Erro ao excluir anexo");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">
          Anexos ({attachments.length})
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Paperclip className="h-4 w-4 mr-1" />
          )}
          {uploading ? "Enviando..." : "Adicionar anexo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {attachments.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum anexo</p>
      )}

      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-3 p-2 rounded-md border border-border bg-surface-elevated group"
          >
            {isImageType(attachment.file_type) ? (
              <a
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <img
                  src={attachment.file_url}
                  alt={attachment.file_name}
                  className="h-12 w-12 rounded object-cover"
                />
              </a>
            ) : (
              <a
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 h-12 w-12 rounded bg-muted flex items-center justify-center"
              >
                <FileText className="h-6 w-6 text-muted-foreground" />
              </a>
            )}

            <div className="flex-1 min-w-0">
              <a
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-white hover:underline truncate block"
              >
                {attachment.file_name}
              </a>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(attachment.file_size)}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  asChild
                >
                  <span>
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </Button>
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(attachment.id)}
                disabled={deletingId === attachment.id}
              >
                {deletingId === attachment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
