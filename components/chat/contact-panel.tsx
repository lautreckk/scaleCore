"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  User,
  Phone,
  Mail,
  Tag,
  StickyNote,
  Plus,
  X,
  Loader2,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { formatPhone, LEAD_STATUS_OPTIONS } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  tags: string[] | null;
  custom_fields: Record<string, unknown> | null;
}

interface LeadNote {
  id: string;
  content: string;
  pinned: boolean;
  created_at: string;
  user_id: string | null;
}

interface Chat {
  id: string;
  remote_jid: string;
  contact_name: string | null;
  tags: string[] | null;
  whatsapp_instances: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  leads: {
    id: string;
    name: string;
  } | null;
}

interface ContactPanelProps {
  chatId: string | null;
}

export function ContactPanel({ chatId }: ContactPanelProps) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      setLead(null);
      setNotes([]);
      return;
    }

    loadData();
  }, [chatId]);

  const loadData = async () => {
    if (!chatId) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    // Load chat
    const { data: chatData } = await supabase
      .from("chats")
      .select(`
        id,
        remote_jid,
        contact_name,
        tags,
        whatsapp_instances(id, name, color),
        leads(id, name)
      `)
      .eq("id", chatId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (chatData) {
      const typedChat = chatData as unknown as Chat;
      setChat(typedChat);

      // Load lead if linked
      if (typedChat.leads?.id) {
        const { data: leadData } = await supabase
          .from("leads")
          .select("*")
          .eq("id", typedChat.leads.id)
          .single();

        if (leadData) {
          setLead(leadData as Lead);

          // Load notes
          const { data: notesData } = await supabase
            .from("lead_notes")
            .select("*")
            .eq("lead_id", leadData.id)
            .order("pinned", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(10);

          if (notesData) {
            setNotes(notesData);
          }
        }
      } else {
        setLead(null);
        setNotes([]);
      }
    }

    setLoading(false);
  };

  const formatPhoneNumber = (jid: string) => {
    const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    if (phone.length === 13 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    return phone;
  };

  const addTag = async () => {
    if (!chat || !newTag.trim()) return;

    setAddingTag(true);
    try {
      const currentTags = chat.tags || [];
      const updatedTags = [...currentTags, newTag.trim()];

      await supabase
        .from("chats")
        .update({ tags: updatedTags })
        .eq("id", chat.id);

      setChat({ ...chat, tags: updatedTags });
      setNewTag("");
      toast.success("Tag adicionada");
    } catch (error) {
      toast.error("Erro ao adicionar tag");
    } finally {
      setAddingTag(false);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    if (!chat) return;

    try {
      const updatedTags = (chat.tags || []).filter((t) => t !== tagToRemove);

      await supabase
        .from("chats")
        .update({ tags: updatedTags })
        .eq("id", chat.id);

      setChat({ ...chat, tags: updatedTags });
      toast.success("Tag removida");
    } catch (error) {
      toast.error("Erro ao remover tag");
    }
  };

  const addNote = async () => {
    if (!lead || !newNote.trim()) return;

    setAddingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("lead_notes")
        .insert({
          lead_id: lead.id,
          user_id: user?.id,
          content: newNote.trim(),
          pinned: false,
        })
        .select()
        .single();

      if (error) throw error;

      setNotes([data, ...notes]);
      setNewNote("");
      toast.success("Nota adicionada");
    } catch (error) {
      toast.error("Erro ao adicionar nota");
    } finally {
      setAddingNote(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    const option = LEAD_STATUS_OPTIONS.find((o) => o.value === status);
    return option?.color || "bg-gray-500";
  };

  const getStatusLabel = (status: string | null) => {
    const option = LEAD_STATUS_OPTIONS.find((o) => o.value === status);
    return option?.label || status || "Desconhecido";
  };

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full text-center p-4">
        <p className="text-muted-foreground">
          Selecione uma conversa para ver os detalhes
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!chat) {
    return null;
  }

  const displayName = chat.contact_name || lead?.name || formatPhoneNumber(chat.remote_jid);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Contact Header */}
        <div className="text-center">
          <div className="h-20 w-20 rounded-full bg-green-600 flex items-center justify-center text-white text-2xl font-medium mx-auto mb-3">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-lg font-semibold text-white">{displayName}</h3>
          <p className="text-sm text-muted-foreground">
            {formatPhoneNumber(chat.remote_jid)}
          </p>
        </div>

        {/* Instance Info */}
        {chat.whatsapp_instances && (
          <div className="flex items-center justify-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: chat.whatsapp_instances.color || "#DC2626" }}
            />
            <span className="text-sm text-muted-foreground">
              {chat.whatsapp_instances.name}
            </span>
          </div>
        )}

        {/* Lead Card */}
        {lead ? (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-white flex items-center gap-2">
                <User className="h-4 w-4" />
                Lead Vinculado
              </h4>
              <Link href={`/leads/${lead.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-white font-medium">{lead.name}</p>

              {lead.email && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {lead.email}
                </p>
              )}

              {lead.phone && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {formatPhone(lead.phone)}
                </p>
              )}

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={getStatusColor(lead.status)}>
                  {getStatusLabel(lead.status)}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum lead vinculado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Leads sao vinculados automaticamente pelo numero de telefone
            </p>
          </div>
        )}

        {/* Tags */}
        <div className="space-y-3">
          <h4 className="font-medium text-white flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </h4>

          <div className="flex flex-wrap gap-2">
            {(chat.tags || []).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Nova tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addTag()}
              className="flex-1"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={addTag}
              disabled={addingTag || !newTag.trim()}
            >
              {addingTag ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Notes (only if lead is linked) */}
        {lead && (
          <div className="space-y-3">
            <h4 className="font-medium text-white flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notas
            </h4>

            <div className="space-y-2">
              <Textarea
                placeholder="Adicionar nota..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                onClick={addNote}
                disabled={addingNote || !newNote.trim()}
                className="w-full"
              >
                {addingNote ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Adicionar Nota
              </Button>
            </div>

            {notes.length > 0 && (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-muted/50 rounded-lg p-3 text-sm"
                  >
                    <p className="text-white whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(note.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
