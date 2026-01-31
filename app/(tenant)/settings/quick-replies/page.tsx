"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Copy,
  Image as ImageIcon,
  FileText,
  Mic,
  Video,
  MessageSquare,
  Search,
  Upload,
  X,
  File,
} from "lucide-react";

interface QuickReply {
  id: string;
  name: string;
  shortcut: string | null;
  category: string | null;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  file_name: string | null;
  usage_count: number;
  is_active: boolean;
  position: number;
  created_at: string;
}

const categories = [
  { value: "saudacao", label: "Saudacao" },
  { value: "atendimento", label: "Atendimento" },
  { value: "informacao", label: "Informacao" },
  { value: "vendas", label: "Vendas" },
  { value: "encerramento", label: "Encerramento" },
  { value: "outros", label: "Outros" },
];

const messageTypes = [
  { value: "text", label: "Texto", icon: MessageSquare },
  { value: "image", label: "Imagem", icon: ImageIcon },
  { value: "document", label: "Documento", icon: FileText },
  { value: "audio", label: "Audio", icon: Mic },
  { value: "video", label: "Video", icon: Video },
];

export default function QuickRepliesPage() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    shortcut: "",
    category: "",
    message_type: "text",
    content: "",
    media_url: "",
    media_mimetype: "",
    file_name: "",
    is_active: true,
  });

  const supabase = createClient();

  useEffect(() => {
    loadQuickReplies();
  }, []);

  const loadQuickReplies = async () => {
    try {
      const response = await fetch("/api/quick-replies?active=true");
      if (!response.ok) throw new Error("Failed to load quick replies");
      const data = await response.json();
      setQuickReplies(data);
    } catch (error) {
      console.error("Error loading quick replies:", error);
      toast.error("Erro ao carregar mensagens rapidas");
    } finally {
      setLoading(false);
    }
  };

  const createQuickReply = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }

    if (formData.message_type === "text" && !formData.content.trim()) {
      toast.error("Conteudo e obrigatorio para mensagens de texto");
      return;
    }

    if (formData.message_type !== "text" && !formData.media_url) {
      toast.error("Arquivo de midia e obrigatorio");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          shortcut: formData.shortcut || null,
          category: formData.category || null,
          message_type: formData.message_type,
          content: formData.content || null,
          media_url: formData.media_url || null,
          media_mimetype: formData.media_mimetype || null,
          file_name: formData.file_name || null,
          is_active: formData.is_active,
        }),
      });

      if (!response.ok) throw new Error("Failed to create");

      toast.success("Mensagem rapida criada!");
      setDialogOpen(false);
      resetForm();
      loadQuickReplies();
    } catch (error) {
      console.error("Error creating quick reply:", error);
      toast.error("Erro ao criar mensagem rapida");
    } finally {
      setSaving(false);
    }
  };

  const updateQuickReply = async () => {
    if (!editingReply) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/quick-replies/${editingReply.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          shortcut: formData.shortcut || null,
          category: formData.category || null,
          message_type: formData.message_type,
          content: formData.content || null,
          media_url: formData.media_url || null,
          media_mimetype: formData.media_mimetype || null,
          file_name: formData.file_name || null,
          is_active: formData.is_active,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Mensagem rapida atualizada!");
      setDialogOpen(false);
      setEditingReply(null);
      resetForm();
      loadQuickReplies();
    } catch (error) {
      console.error("Error updating quick reply:", error);
      toast.error("Erro ao atualizar mensagem rapida");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuickReply = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta mensagem rapida?")) return;

    try {
      const response = await fetch(`/api/quick-replies/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Mensagem rapida excluida");
      loadQuickReplies();
    } catch (error) {
      console.error("Error deleting quick reply:", error);
      toast.error("Erro ao excluir mensagem rapida");
    }
  };

  const toggleActive = async (reply: QuickReply) => {
    try {
      const response = await fetch(`/api/quick-replies/${reply.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !reply.is_active }),
      });

      if (!response.ok) throw new Error("Failed to toggle");

      loadQuickReplies();
    } catch (error) {
      console.error("Error toggling quick reply:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const duplicateQuickReply = (reply: QuickReply) => {
    setFormData({
      name: `${reply.name} (copia)`,
      shortcut: "",
      category: reply.category || "",
      message_type: reply.message_type,
      content: reply.content || "",
      media_url: reply.media_url || "",
      media_mimetype: reply.media_mimetype || "",
      file_name: reply.file_name || "",
      is_active: true,
    });
    setEditingReply(null);
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Maximo: 16MB");
      return;
    }

    setUploadingMedia(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) throw new Error("Failed to upload");

      const data = await response.json();

      setFormData({
        ...formData,
        media_url: data.url,
        media_mimetype: file.type,
        file_name: file.name,
      });

      toast.success("Arquivo enviado!");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      shortcut: "",
      category: "",
      message_type: "text",
      content: "",
      media_url: "",
      media_mimetype: "",
      file_name: "",
      is_active: true,
    });
  };

  const openEditDialog = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormData({
      name: reply.name,
      shortcut: reply.shortcut || "",
      category: reply.category || "",
      message_type: reply.message_type,
      content: reply.content || "",
      media_url: reply.media_url || "",
      media_mimetype: reply.media_mimetype || "",
      file_name: reply.file_name || "",
      is_active: reply.is_active,
    });
    setDialogOpen(true);
  };

  const getMessageTypeIcon = (type: string) => {
    const typeInfo = messageTypes.find((t) => t.value === type);
    return typeInfo ? typeInfo.icon : MessageSquare;
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return null;
    const cat = categories.find((c) => c.value === category);
    return cat ? cat.label : category;
  };

  const filteredReplies = quickReplies.filter((reply) => {
    const matchesCategory = filterCategory === "all" || reply.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      reply.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.shortcut?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedReplies = filteredReplies.reduce((acc, reply) => {
    const cat = reply.category || "outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(reply);
    return acc;
  }, {} as Record<string, QuickReply[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mensagens Rapidas</CardTitle>
            <CardDescription>
              Configure mensagens rapidas para usar no chat digitando "/"
            </CardDescription>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingReply(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Mensagem
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingReply ? "Editar Mensagem Rapida" : "Nova Mensagem Rapida"}
                </DialogTitle>
                <DialogDescription>
                  Configure uma mensagem para acesso rapido no chat
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Bom dia"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortcut">Atalho</Label>
                  <Input
                    id="shortcut"
                    placeholder="Ex: bomdia"
                    value={formData.shortcut}
                    onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite /{formData.shortcut || "atalho"} no chat para usar
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Mensagem</Label>
                  <div className="flex flex-wrap gap-2">
                    {messageTypes.map((type) => (
                      <Button
                        key={type.value}
                        type="button"
                        variant={formData.message_type === type.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFormData({ ...formData, message_type: type.value })}
                      >
                        <type.icon className="h-4 w-4 mr-1" />
                        {type.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {formData.message_type === "text" ? (
                  <div className="space-y-2">
                    <Label htmlFor="content">Conteudo *</Label>
                    <Textarea
                      id="content"
                      placeholder="Digite o conteudo da mensagem..."
                      rows={4}
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Arquivo de Midia *</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={
                        formData.message_type === "image"
                          ? "image/*"
                          : formData.message_type === "video"
                          ? "video/*"
                          : formData.message_type === "audio"
                          ? "audio/*"
                          : "*"
                      }
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {formData.media_url ? (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          {formData.message_type === "image" && formData.media_url ? (
                            <img
                              src={formData.media_url}
                              alt="Preview"
                              className="h-16 w-16 object-cover rounded"
                            />
                          ) : (
                            <div className="h-16 w-16 bg-background rounded flex items-center justify-center">
                              <File className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{formData.file_name}</p>
                            <p className="text-xs text-muted-foreground">{formData.media_mimetype}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setFormData({ ...formData, media_url: "", media_mimetype: "", file_name: "" })
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingMedia}
                      >
                        {uploadingMedia ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploadingMedia ? "Enviando..." : "Enviar arquivo"}
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Mensagem Ativa</Label>
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={editingReply ? updateQuickReply : createQuickReply} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingReply ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mensagens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : quickReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Zap className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma mensagem rapida configurada</p>
              <p className="text-sm text-muted-foreground">
                Crie mensagens para usar rapidamente no chat
              </p>
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma mensagem encontrada</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedReplies).map(([category, replies]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {getCategoryLabel(category) || "Outros"}
                  </h3>
                  <div className="space-y-3">
                    {replies.map((reply) => {
                      const TypeIcon = getMessageTypeIcon(reply.message_type);
                      return (
                        <div
                          key={reply.id}
                          className="p-4 rounded-lg border border-border flex items-start gap-4"
                        >
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <TypeIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-white">{reply.name}</p>
                              {reply.shortcut && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  /{reply.shortcut}
                                </Badge>
                              )}
                              <Badge variant={reply.is_active ? "success" : "outline"}>
                                {reply.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                            </div>
                            {reply.message_type === "text" && reply.content && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {reply.content}
                              </p>
                            )}
                            {reply.message_type !== "text" && reply.file_name && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {reply.file_name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Usado {reply.usage_count} vezes
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Switch
                              checked={reply.is_active}
                              onCheckedChange={() => toggleActive(reply)}
                            />
                            <Button variant="ghost" size="sm" onClick={() => duplicateQuickReply(reply)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(reply)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteQuickReply(reply.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como Usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-white mb-2">No Chat</h4>
            <p className="text-sm text-muted-foreground">
              Digite "/" no campo de mensagem para ver todas as mensagens rapidas disponiveis.
              Use as setas para navegar e Enter para selecionar.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">Atalhos</h4>
            <p className="text-sm text-muted-foreground">
              Configure atalhos para acessar mensagens diretamente. Por exemplo, digite "/bomdia"
              para usar a mensagem com esse atalho.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">Tipos de Midia</h4>
            <p className="text-sm text-muted-foreground">
              Alem de texto, voce pode configurar imagens, documentos, audios e videos como
              mensagens rapidas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
