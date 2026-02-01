"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Music,
  Image as ImageIcon,
  FileText,
  Video,
  Loader2,
  Play,
  Eye,
  X,
} from "lucide-react";

interface WarmingMedia {
  id: string;
  type: "audio" | "image" | "document" | "video";
  name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  duration_seconds: number | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

interface MediaLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MEDIA_TYPES = [
  { value: "audio", label: "Audios", icon: Music, accept: "audio/*", maxSize: 10 },
  { value: "image", label: "Imagens", icon: ImageIcon, accept: "image/*", maxSize: 5 },
  { value: "document", label: "Documentos", icon: FileText, accept: ".pdf,.doc,.docx,.xls,.xlsx", maxSize: 10 },
  { value: "video", label: "Videos", icon: Video, accept: "video/*", maxSize: 50 },
];

export function MediaLibrary({ open, onOpenChange }: MediaLibraryProps) {
  const [activeTab, setActiveTab] = useState("audio");
  const [media, setMedia] = useState<WarmingMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warming/media?type=${activeTab}`);
      if (response.ok) {
        const data = await response.json();
        setMedia(data.data || []);
      }
    } catch (error) {
      console.error("Error loading media:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (open) {
      loadMedia();
    }
  }, [open, loadMedia]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const mediaType = MEDIA_TYPES.find((t) => t.value === activeTab);
    if (!mediaType) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        // Validate file size
        const maxSizeMB = mediaType.maxSize;
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(`${file.name}: Arquivo muito grande (max ${maxSizeMB}MB)`);
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `${activeTab}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("warming-media")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`${file.name}: Erro no upload`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("warming-media")
          .getPublicUrl(fileName);

        // Get duration for audio/video
        let duration = null;
        if (activeTab === "audio" || activeTab === "video") {
          duration = await getMediaDuration(file);
        }

        // Save to database
        const response = await fetch("/api/warming/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: activeTab,
            name: file.name,
            file_path: fileName,
            file_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.type,
            duration_seconds: duration,
          }),
        });

        if (!response.ok) {
          toast.error(`${file.name}: Erro ao salvar`);
          continue;
        }

        toast.success(`${file.name} enviado com sucesso`);
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error(`${file.name}: Erro ao enviar`);
      }
    }

    setUploading(false);
    loadMedia();

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (mediaItem: WarmingMedia) => {
    if (!confirm(`Excluir "${mediaItem.name}"?`)) return;

    setDeleting(mediaItem.id);
    try {
      const response = await fetch(`/api/warming/media/${mediaItem.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir");
      }

      toast.success("Arquivo excluido");
      loadMedia();
    } catch (error) {
      toast.error("Erro ao excluir arquivo");
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getMediaDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const element = document.createElement(
        file.type.startsWith("audio/") ? "audio" : "video"
      );
      element.preload = "metadata";
      element.onloadedmetadata = () => {
        resolve(Math.round(element.duration));
        URL.revokeObjectURL(element.src);
      };
      element.onerror = () => resolve(null);
      element.src = URL.createObjectURL(file);
    });
  };

  const openPreview = (item: WarmingMedia) => {
    setPreviewUrl(item.file_url);
    setPreviewType(item.type);
  };

  const currentMediaType = MEDIA_TYPES.find((t) => t.value === activeTab);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Biblioteca de Midia - Aquecimento</DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid grid-cols-4 w-full">
              {MEDIA_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <TabsTrigger
                    key={type.value}
                    value={type.value}
                    className="gap-1 text-xs"
                  >
                    <Icon className="h-3 w-3" />
                    {type.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              {MEDIA_TYPES.map((type) => (
                <TabsContent
                  key={type.value}
                  value={type.value}
                  className="h-full flex flex-col m-0"
                >
                  {/* Upload Area */}
                  <div className="mb-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={type.accept}
                      multiple
                      onChange={handleUpload}
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full"
                      variant="outline"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? "Enviando..." : `Enviar ${type.label}`}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Max {type.maxSize}MB por arquivo
                    </p>
                  </div>

                  {/* Media List */}
                  <div className="flex-1 overflow-y-auto">
                    {loading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : media.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        {React.createElement(type.icon, { className: "h-8 w-8 mb-2" })}
                        <p className="text-sm">Nenhum arquivo ainda</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {media.map((item) => (
                          <MediaItem
                            key={item.id}
                            item={item}
                            onDelete={() => handleDelete(item)}
                            onPreview={() => openPreview(item)}
                            deleting={deleting === item.id}
                            formatFileSize={formatFileSize}
                            formatDuration={formatDuration}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  {media.length > 0 && (
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                      {media.length} arquivo(s) -{" "}
                      {formatFileSize(media.reduce((acc, m) => acc + m.file_size, 0))} total
                    </div>
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {previewUrl && (
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              {previewType === "audio" && (
                <audio src={previewUrl} controls className="w-full" />
              )}
              {previewType === "video" && (
                <video src={previewUrl} controls className="max-h-[60vh] w-full" />
              )}
              {previewType === "image" && (
                <img src={previewUrl} alt="Preview" className="max-h-[60vh] object-contain" />
              )}
              {previewType === "document" && (
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Abrir documento
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Media Item Component
function MediaItem({
  item,
  onDelete,
  onPreview,
  deleting,
  formatFileSize,
  formatDuration,
}: {
  item: WarmingMedia;
  onDelete: () => void;
  onPreview: () => void;
  deleting: boolean;
  formatFileSize: (bytes: number) => string;
  formatDuration: (seconds: number | null) => string;
}) {
  const getIcon = () => {
    switch (item.type) {
      case "audio":
        return Music;
      case "image":
        return ImageIcon;
      case "document":
        return FileText;
      case "video":
        return Video;
      default:
        return FileText;
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-surface-elevated transition-colors">
      {/* Thumbnail */}
      <div className="h-12 w-12 rounded-lg bg-surface-elevated flex items-center justify-center overflow-hidden flex-shrink-0">
        {item.type === "image" ? (
          <img
            src={item.file_url}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(item.file_size)}</span>
          {item.duration_seconds && (
            <>
              <span>•</span>
              <span>{formatDuration(item.duration_seconds)}</span>
            </>
          )}
          {item.usage_count > 0 && (
            <>
              <span>•</span>
              <span>{item.usage_count}x usado</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onPreview}
        >
          {item.type === "audio" || item.type === "video" ? (
            <Play className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
