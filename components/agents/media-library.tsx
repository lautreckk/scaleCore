"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Upload,
  Pencil,
  Trash2,
  Image,
  Video,
  Music,
  FileText,
} from "lucide-react";

interface AiAgentMediaRow {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  media_type: "image" | "video" | "audio" | "document";
  file_url: string;
  mime_type: string;
  file_size: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MediaLibraryProps {
  agentId: string;
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: "Imagem",
  video: "Video",
  audio: "Audio",
  document: "Documento",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function MediaTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case "image":
      return <Image className={className} />;
    case "video":
      return <Video className={className} />;
    case "audio":
      return <Music className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function MediaLibrary({ agentId }: MediaLibraryProps) {
  const [mediaItems, setMediaItems] = useState<AiAgentMediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AiAgentMediaRow | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/media`);
      if (res.ok) {
        const result = await res.json();
        setMediaItems(result.data || []);
      }
    } catch {
      toast.error("Erro ao carregar midias");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Client-side size validation
    if (file.size > 10 * 1024 * 1024) {
      toast.error(
        "Erro ao enviar arquivo. Verifique o tamanho (max 10MB) e tente novamente."
      );
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    // Default name: filename without extension
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    formData.append("name", nameWithoutExt);
    formData.append("description", "");

    try {
      const res = await fetch(`/api/agents/${agentId}/media`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Erro ao enviar arquivo");
        return;
      }

      const result = await res.json();
      // Prepend new item to list
      setMediaItems((prev) => [result.data, ...prev]);
      // Enter edit mode for the new item
      setEditingId(result.data.id);
      setEditName(result.data.name);
      setEditDescription(result.data.description || "");
      setNameError("");
      setDescriptionError("");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingId) return;

    // Validate
    let hasError = false;
    if (!editName.trim()) {
      setNameError("Nome e obrigatorio");
      hasError = true;
    } else {
      setNameError("");
    }
    if (!editDescription.trim()) {
      setDescriptionError("Descricao e obrigatoria");
      hasError = true;
    } else {
      setDescriptionError("");
    }
    if (hasError) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/media/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      });

      if (!res.ok) {
        toast.error("Erro ao salvar midia");
        return;
      }

      const result = await res.json();
      setMediaItems((prev) =>
        prev.map((item) => (item.id === editingId ? result.data : item))
      );
      toast.success("Midia salva com sucesso");
      setEditingId(null);
      setNameError("");
      setDescriptionError("");
    } catch {
      toast.error("Erro ao salvar midia");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(
        `/api/agents/${agentId}/media/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        toast.error("Erro ao remover midia");
        return;
      }

      setMediaItems((prev) =>
        prev.filter((item) => item.id !== deleteTarget.id)
      );
      toast.success("Midia removida");
    } catch {
      toast.error("Erro ao remover midia");
    } finally {
      setDeleteTarget(null);
    }
  };

  const startEdit = (item: AiAgentMediaRow) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || "");
    setNameError("");
    setDescriptionError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setNameError("");
    setDescriptionError("");
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Biblioteca de Midia</h2>
          <span className="text-sm text-muted-foreground">
            {mediaItems.length}/20 midias
          </span>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,.pdf,.doc,.docx"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || mediaItems.length >= 20}
            title={
              mediaItems.length >= 20
                ? "Limite de 20 midias atingido"
                : undefined
            }
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Enviando..." : "Adicionar midia"}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-[88px] w-full rounded-lg" />
          <Skeleton className="h-[88px] w-full rounded-lg" />
          <Skeleton className="h-[88px] w-full rounded-lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && mediaItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-semibold">Nenhuma midia adicionada</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione imagens, videos, audios ou documentos que a IA podera
            enviar durante as conversas.
          </p>
        </div>
      )}

      {/* Media list */}
      {!loading && mediaItems.length > 0 && (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {mediaItems.map((item) => (
              <Card
                key={item.id}
                className="bg-card border-border rounded-lg p-4"
              >
                {editingId === item.id ? (
                  /* Edit mode */
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center rounded-md bg-muted">
                        {item.media_type === "image" ? (
                          <img
                            src={item.file_url}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-md"
                          />
                        ) : (
                          <MediaTypeIcon
                            type={item.media_type}
                            className="h-6 w-6 text-muted-foreground"
                          />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div>
                          <Input
                            value={editName}
                            onChange={(e) => {
                              setEditName(e.target.value);
                              if (e.target.value.trim()) setNameError("");
                            }}
                            placeholder="Nome da midia (ex: Catalogo de produtos)"
                            className={nameError ? "border-red-500" : ""}
                          />
                          {nameError && (
                            <p className="text-xs text-red-500 mt-1">
                              {nameError}
                            </p>
                          )}
                        </div>
                        <div>
                          <Input
                            value={editDescription}
                            onChange={(e) => {
                              setEditDescription(e.target.value);
                              if (e.target.value.trim())
                                setDescriptionError("");
                            }}
                            placeholder="Descricao para a IA saber quando enviar esta midia"
                            className={
                              descriptionError ? "border-red-500" : ""
                            }
                          />
                          {descriptionError && (
                            <p className="text-xs text-red-500 mt-1">
                              {descriptionError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center rounded-md bg-muted">
                      {item.media_type === "image" ? (
                        <img
                          src={item.file_url}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-md"
                        />
                      ) : (
                        <MediaTypeIcon
                          type={item.media_type}
                          className="h-6 w-6 text-muted-foreground"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {MEDIA_TYPE_LABELS[item.media_type] || item.media_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(item.file_size)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(item)}
                        aria-label={`Editar ${item.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(item)}
                        aria-label={`Remover ${item.name}`}
                        className="hover:bg-destructive/15 hover:border hover:border-destructive/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover midia</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover &quot;{deleteTarget?.name}&quot;? A
              IA nao podera mais enviar esta midia nas conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover midia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
