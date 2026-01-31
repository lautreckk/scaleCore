"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  GripVertical,
  Trash2,
  Image,
  Video,
  Mic,
  FileText,
  MessageSquare,
  Clock,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export interface CampaignMessage {
  id: string;
  message_type: "text" | "image" | "video" | "audio" | "document";
  content: string;
  media_url?: string;
  media_mimetype?: string;
  file_name?: string;
  delay_after: number;
}

interface MessageComposerProps {
  messages: CampaignMessage[];
  onChange: (messages: CampaignMessage[]) => void;
  delayBetweenMessages: number;
  onDelayChange: (delay: number) => void;
}

const MESSAGE_TYPES = [
  { value: "text", label: "Texto", icon: MessageSquare },
  { value: "image", label: "Imagem", icon: Image },
  { value: "video", label: "Vídeo", icon: Video },
  { value: "audio", label: "Áudio", icon: Mic },
  { value: "document", label: "Documento", icon: FileText },
];

const VARIABLES = [
  { name: "{{nome}}", description: "Nome do lead" },
  { name: "{{empresa}}", description: "Empresa do lead" },
  { name: "{{email}}", description: "Email do lead" },
  { name: "{{telefone}}", description: "Telefone do lead" },
  { name: "{{source}}", description: "Origem do lead" },
];

const SAMPLE_DATA = {
  nome: "João Silva",
  empresa: "Tech Solutions",
  email: "joao@techsolutions.com",
  telefone: "11999887766",
  source: "WhatsApp",
};

export function MessageComposer({
  messages,
  onChange,
  delayBetweenMessages,
  onDelayChange,
}: MessageComposerProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMessageId, setUploadingMessageId] = useState<string | null>(null);

  const addMessage = (type: CampaignMessage["message_type"] = "text") => {
    const newMessage: CampaignMessage = {
      id: crypto.randomUUID(),
      message_type: type,
      content: "",
      delay_after: 0,
    };
    onChange([...messages, newMessage]);
  };

  const updateMessage = (id: string, updates: Partial<CampaignMessage>) => {
    onChange(
      messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  };

  const deleteMessage = (id: string) => {
    onChange(messages.filter((msg) => msg.id !== id));
  };

  const moveMessage = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= messages.length) return;

    const newMessages = [...messages];
    [newMessages[fromIndex], newMessages[toIndex]] = [
      newMessages[toIndex],
      newMessages[fromIndex],
    ];
    onChange(newMessages);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newMessages = [...messages];
    const draggedMessage = newMessages[draggedIndex];
    newMessages.splice(draggedIndex, 1);
    newMessages.splice(index, 0, draggedMessage);
    onChange(newMessages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const insertVariable = (messageId: string, variable: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    updateMessage(messageId, {
      content: message.content + variable,
    });
  };

  const replaceVariables = (text: string): string => {
    let result = text;
    result = result.replace(/\{\{nome\}\}/gi, SAMPLE_DATA.nome);
    result = result.replace(/\{\{empresa\}\}/gi, SAMPLE_DATA.empresa);
    result = result.replace(/\{\{email\}\}/gi, SAMPLE_DATA.email);
    result = result.replace(/\{\{telefone\}\}/gi, SAMPLE_DATA.telefone);
    result = result.replace(/\{\{source\}\}/gi, SAMPLE_DATA.source);
    return result;
  };

  const handleFileSelect = async (messageId: string, file: File) => {
    // In a real implementation, upload to Supabase Storage
    // For now, create a data URL for preview
    const reader = new FileReader();
    reader.onload = () => {
      updateMessage(messageId, {
        media_url: reader.result as string,
        media_mimetype: file.type,
        file_name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const getTypeIcon = (type: CampaignMessage["message_type"]) => {
    const typeConfig = MESSAGE_TYPES.find((t) => t.value === type);
    return typeConfig?.icon || MessageSquare;
  };

  return (
    <div className="space-y-4">
      {/* Global Settings */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Configurações de tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            <Label htmlFor="delay" className="whitespace-nowrap">
              Intervalo entre mensagens:
            </Label>
            <Select
              value={String(delayBetweenMessages)}
              onValueChange={(v) => onDelayChange(parseInt(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 segundo</SelectItem>
                <SelectItem value="2">2 segundos</SelectItem>
                <SelectItem value="3">3 segundos</SelectItem>
                <SelectItem value="5">5 segundos</SelectItem>
                <SelectItem value="10">10 segundos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <div className="space-y-3">
        {messages.map((message, index) => {
          const TypeIcon = getTypeIcon(message.message_type);

          return (
            <Card
              key={message.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`transition-all ${
                draggedIndex === index ? "opacity-50 scale-[0.98]" : ""
              }`}
            >
              <CardHeader className="py-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Badge variant="secondary" className="gap-1">
                    <TypeIcon className="h-3 w-3" />
                    {MESSAGE_TYPES.find((t) => t.value === message.message_type)?.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Mensagem {index + 1}
                  </span>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveMessage(index, "up")}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveMessage(index, "down")}
                      disabled={index === messages.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMessage(message.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Message Type Selector */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Tipo:</Label>
                  <Select
                    value={message.message_type}
                    onValueChange={(v) =>
                      updateMessage(message.id, {
                        message_type: v as CampaignMessage["message_type"],
                      })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESSAGE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Media Upload for non-text messages */}
                {message.message_type !== "text" && (
                  <div className="space-y-2">
                    <Label>Arquivo de mídia</Label>
                    {message.media_url ? (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <TypeIcon className="h-4 w-4" />
                        <span className="text-sm flex-1 truncate">
                          {message.file_name || "Arquivo selecionado"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateMessage(message.id, {
                              media_url: undefined,
                              file_name: undefined,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Input
                          type="file"
                          accept={
                            message.message_type === "image"
                              ? "image/*"
                              : message.message_type === "video"
                              ? "video/*"
                              : message.message_type === "audio"
                              ? "audio/*"
                              : "*/*"
                          }
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(message.id, file);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Content/Caption */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      {message.message_type === "text" ? "Mensagem" : "Legenda"}
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {VARIABLES.map((v) => (
                        <Badge
                          key={v.name}
                          variant="outline"
                          className="cursor-pointer text-xs"
                          onClick={() => insertVariable(message.id, v.name)}
                          title={v.description}
                        >
                          {v.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    placeholder={
                      message.message_type === "text"
                        ? "Digite sua mensagem aqui..."
                        : "Legenda opcional..."
                    }
                    value={message.content}
                    onChange={(e) =>
                      updateMessage(message.id, { content: e.target.value })
                    }
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {message.content.length} caracteres
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Message Button */}
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => addMessage("text")}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar mensagem
        </Button>
        <Select onValueChange={(v) => addMessage(v as CampaignMessage["message_type"])}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo..." />
          </SelectTrigger>
          <SelectContent>
            {MESSAGE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <span className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogTrigger asChild>
          <Button
            variant="secondary"
            className="w-full"
            disabled={messages.length === 0}
          >
            <Eye className="h-4 w-4 mr-2" />
            Visualizar mensagens
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview das mensagens</DialogTitle>
            <DialogDescription>
              Visualização com dados de exemplo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {messages.map((message, index) => (
              <div key={message.id} className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Mensagem {index + 1}
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 max-w-[80%] ml-auto">
                  {message.message_type !== "text" && message.media_url && (
                    <div className="mb-2">
                      {message.message_type === "image" ? (
                        <img
                          src={message.media_url}
                          alt="Preview"
                          className="rounded-md max-h-40 object-cover"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          {message.message_type === "video" && <Video className="h-4 w-4" />}
                          {message.message_type === "audio" && <Mic className="h-4 w-4" />}
                          {message.message_type === "document" && <FileText className="h-4 w-4" />}
                          {message.file_name || "Arquivo"}
                        </div>
                      )}
                    </div>
                  )}
                  {message.content && (
                    <p className="text-sm whitespace-pre-wrap">
                      {replaceVariables(message.content)}
                    </p>
                  )}
                </div>
                {index < messages.length - 1 && (
                  <div className="text-xs text-center text-muted-foreground">
                    ↓ {delayBetweenMessages}s
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary */}
      {messages.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total: {messages.length} mensagem(ns)
              </span>
              <span className="text-muted-foreground">
                Custo por destinatário: R$ {(messages.length * 0.12).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
