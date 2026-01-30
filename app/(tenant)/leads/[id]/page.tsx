"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  MessageSquare,
  Edit,
  Save,
  X,
  Plus,
  Clock,
  Tag,
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lead_sources?: { name: string } | null;
}

interface LeadNote {
  id: string;
  content: string;
  created_at: string;
  tenant_users: { name: string } | null;
}

interface LeadActivity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
  tenant_users: { name: string } | null;
}

const statusOptions = [
  { value: "new", label: "Novo", color: "bg-blue-500" },
  { value: "contacted", label: "Contactado", color: "bg-yellow-500" },
  { value: "qualified", label: "Qualificado", color: "bg-green-500" },
  { value: "proposal", label: "Proposta", color: "bg-purple-500" },
  { value: "negotiation", label: "Negociação", color: "bg-orange-500" },
  { value: "won", label: "Ganho", color: "bg-emerald-500" },
  { value: "lost", label: "Perdido", color: "bg-red-500" },
];

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "",
    notes: "",
  });
  const supabase = createClient();

  useEffect(() => {
    loadLead();
  }, [id]);

  const loadLead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    // Load lead
    const { data: leadData, error } = await supabase
      .from("leads")
      .select("*, lead_sources(name)")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !leadData) {
      toast.error("Lead não encontrado");
      router.push("/leads");
      return;
    }

    setLead(leadData);
    setFormData({
      name: leadData.name,
      email: leadData.email || "",
      phone: leadData.phone || "",
      company: leadData.company || "",
      status: leadData.status,
      notes: leadData.notes || "",
    });

    // Load notes
    const { data: notesData } = await supabase
      .from("lead_notes")
      .select("*, tenant_users(name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    setNotes(notesData || []);

    // Load activities
    const { data: activitiesData } = await supabase
      .from("lead_activities")
      .select("*, tenant_users(name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    setActivities(activitiesData || []);
    setLoading(false);
  };

  const saveLead = async () => {
    if (!lead) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          company: formData.company || null,
          status: formData.status,
          notes: formData.notes || null,
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead atualizado com sucesso!");
      setEditing(false);
      loadLead();
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Erro ao salvar lead");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !lead) return;

    setAddingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase.from("lead_notes").insert({
        lead_id: lead.id,
        user_id: tenantUser?.id,
        content: newNote,
      });

      if (error) throw error;

      toast.success("Nota adicionada!");
      setNewNote("");
      loadLead();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Erro ao adicionar nota");
    } finally {
      setAddingNote(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color || "bg-gray-500"} text-white`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/leads">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{lead.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(lead.status)}
              {lead.lead_sources?.name && (
                <Badge variant="outline">{lead.lead_sources.name}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={saveLead} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Link href={`/chats?lead=${lead.id}`}>
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Conversar
                </Button>
              </Link>
              <Button onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lead Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Empresa</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) =>
                          setFormData({ ...formData, company: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-white">
                      {lead.email || "Não informado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-white">
                      {lead.phone || "Não informado"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-white">
                      {lead.company || "Não informada"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Criado em {formatDate(lead.created_at)}
                    </span>
                  </div>
                  {lead.notes && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">
                        Observações
                      </p>
                      <p className="text-white whitespace-pre-wrap">
                        {lead.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar uma nota..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                />
                <Button onClick={addNote} disabled={addingNote || !newNote.trim()}>
                  {addingNote ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {notes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma nota adicionada
                </p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <p className="text-white whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {note.tenant_users?.name || "Sistema"} •{" "}
                        {formatDate(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Atividades</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma atividade registrada
                </p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
