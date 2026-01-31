"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Settings, Clock, Zap, Gauge, Bot, X, Plus } from "lucide-react";

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string | null;
  color: string | null;
  status: string | null;
}

interface WarmingConfigInput {
  id?: string;
  name: string;
  description: string;
  run_24h: boolean;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  timezone: string;
  text_messages_enabled: boolean;
  text_messages_weight: number;
  audio_messages_enabled: boolean;
  audio_messages_weight: number;
  image_messages_enabled: boolean;
  image_messages_weight: number;
  document_messages_enabled: boolean;
  document_messages_weight: number;
  video_messages_enabled: boolean;
  video_messages_weight: number;
  status_posts_enabled: boolean;
  status_posts_weight: number;
  status_views_enabled: boolean;
  status_views_weight: number;
  reactions_enabled: boolean;
  reactions_weight: number;
  min_delay_between_actions: number;
  max_delay_between_actions: number;
  min_typing_duration: number;
  max_typing_duration: number;
  max_messages_per_day: number;
  max_audio_per_day: number;
  max_media_per_day: number;
  max_status_per_day: number;
  max_reactions_per_day: number;
  use_ai_conversations: boolean;
  ai_topics: string[];
  ai_tone: string;
  ai_language: string;
  instance_ids?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WarmingConfigProp = any;

interface ConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: WarmingConfigProp | null;
  instances: WhatsAppInstance[];
  onSave: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasilia (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
];

const AI_TONES = [
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "amigavel", label: "Amigavel" },
  { value: "profissional", label: "Profissional" },
];

const DEFAULT_CONFIG: WarmingConfigInput = {
  name: "",
  description: "",
  run_24h: true,
  start_time: "08:00",
  end_time: "22:00",
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  timezone: "America/Sao_Paulo",
  text_messages_enabled: true,
  text_messages_weight: 50,
  audio_messages_enabled: true,
  audio_messages_weight: 15,
  image_messages_enabled: true,
  image_messages_weight: 10,
  document_messages_enabled: false,
  document_messages_weight: 5,
  video_messages_enabled: false,
  video_messages_weight: 5,
  status_posts_enabled: true,
  status_posts_weight: 10,
  status_views_enabled: true,
  status_views_weight: 5,
  reactions_enabled: true,
  reactions_weight: 5,
  min_delay_between_actions: 60,
  max_delay_between_actions: 300,
  min_typing_duration: 2,
  max_typing_duration: 15,
  max_messages_per_day: 50,
  max_audio_per_day: 10,
  max_media_per_day: 10,
  max_status_per_day: 5,
  max_reactions_per_day: 20,
  use_ai_conversations: false,
  ai_topics: [],
  ai_tone: "casual",
  ai_language: "pt-BR",
  instance_ids: [],
};

export function ConfigModal({
  open,
  onOpenChange,
  config,
  instances,
  onSave,
}: ConfigModalProps) {
  const [formData, setFormData] = useState<WarmingConfigInput>(DEFAULT_CONFIG);
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        ...DEFAULT_CONFIG,
        ...config,
      });
      setSelectedInstances(config.instance_ids || []);
    } else {
      setFormData(DEFAULT_CONFIG);
      setSelectedInstances([]);
    }
  }, [config, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }

    if (selectedInstances.length < 2) {
      toast.error("Selecione pelo menos 2 instancias");
      return;
    }

    setSaving(true);

    try {
      const url = config?.id
        ? `/api/warming/configs/${config.id}`
        : "/api/warming/configs";

      const response = await fetch(url, {
        method: config?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          instance_ids: selectedInstances,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar");
      }

      toast.success(config?.id ? "Configuracao atualizada" : "Configuracao criada");
      onSave();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleInstance = (instanceId: string) => {
    setSelectedInstances((prev) =>
      prev.includes(instanceId)
        ? prev.filter((id) => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  const addTopic = () => {
    if (newTopic.trim() && !formData.ai_topics.includes(newTopic.trim())) {
      setFormData((prev) => ({
        ...prev,
        ai_topics: [...prev.ai_topics, newTopic.trim()],
      }));
      setNewTopic("");
    }
  };

  const removeTopic = (topic: string) => {
    setFormData((prev) => ({
      ...prev,
      ai_topics: prev.ai_topics.filter((t) => t !== topic),
    }));
  };

  const connectedInstances = instances.filter((i) => i.status === "connected");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {config?.id ? "Editar" : "Nova"} Configuracao de Aquecimento
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="mt-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="geral" className="gap-1 text-xs">
              <Settings className="h-3 w-3" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="horarios" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Horarios
            </TabsTrigger>
            <TabsTrigger value="acoes" className="gap-1 text-xs">
              <Zap className="h-3 w-3" />
              Acoes
            </TabsTrigger>
            <TabsTrigger value="limites" className="gap-1 text-xs">
              <Gauge className="h-3 w-3" />
              Limites
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-1 text-xs">
              <Bot className="h-3 w-3" />
              IA
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="geral" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Ex: Aquecimento Vendas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descricao opcional..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Instancias Participantes (minimo 2)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecione as instancias que participarao do aquecimento
              </p>

              {connectedInstances.length < 2 ? (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-500">
                    Voce precisa de pelo menos 2 instancias conectadas para usar
                    o aquecimento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {connectedInstances.map((instance) => (
                    <div
                      key={instance.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedInstances.includes(instance.id)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => toggleInstance(instance.id)}
                    >
                      <Checkbox
                        checked={selectedInstances.includes(instance.id)}
                        onCheckedChange={() => toggleInstance(instance.id)}
                      />
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: instance.color || "#22c55e" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {instance.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {instance.phone_number || "Sem numero"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selectedInstances.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedInstances.length} instancia(s) selecionada(s)
                </p>
              )}
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="horarios" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Rodar 24 horas</Label>
                <p className="text-xs text-muted-foreground">
                  O aquecimento funcionara o dia todo
                </p>
              </div>
              <Switch
                checked={formData.run_24h}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, run_24h: checked }))
                }
              />
            </div>

            {!formData.run_24h && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora Inicio</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        start_time: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora Fim</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        end_time: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Dias Ativos</Label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    size="sm"
                    variant={
                      formData.days_of_week.includes(day.value)
                        ? "default"
                        : "outline"
                    }
                    onClick={() => toggleDay(day.value)}
                    className="w-10"
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fuso Horario</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="acoes" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay Minimo (segundos)</Label>
                <Input
                  type="number"
                  value={formData.min_delay_between_actions}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_delay_between_actions: parseInt(e.target.value) || 60,
                    }))
                  }
                  min={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Delay Maximo (segundos)</Label>
                <Input
                  type="number"
                  value={formData.max_delay_between_actions}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_delay_between_actions:
                        parseInt(e.target.value) || 300,
                    }))
                  }
                  min={30}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Tipos de Acao (peso define frequencia)</Label>

              {/* Text Messages */}
              <ActionSlider
                label="Mensagens de Texto"
                enabled={formData.text_messages_enabled}
                weight={formData.text_messages_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, text_messages_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, text_messages_weight: v }))
                }
              />

              {/* Audio Messages */}
              <ActionSlider
                label="Audios/Voz"
                enabled={formData.audio_messages_enabled}
                weight={formData.audio_messages_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, audio_messages_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, audio_messages_weight: v }))
                }
              />

              {/* Images */}
              <ActionSlider
                label="Imagens"
                enabled={formData.image_messages_enabled}
                weight={formData.image_messages_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, image_messages_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, image_messages_weight: v }))
                }
              />

              {/* Documents */}
              <ActionSlider
                label="Documentos"
                enabled={formData.document_messages_enabled}
                weight={formData.document_messages_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, document_messages_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, document_messages_weight: v }))
                }
              />

              {/* Videos */}
              <ActionSlider
                label="Videos"
                enabled={formData.video_messages_enabled}
                weight={formData.video_messages_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, video_messages_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, video_messages_weight: v }))
                }
              />

              {/* Status Posts */}
              <ActionSlider
                label="Postar Status"
                enabled={formData.status_posts_enabled}
                weight={formData.status_posts_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, status_posts_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, status_posts_weight: v }))
                }
              />

              {/* Status Views */}
              <ActionSlider
                label="Visualizar Status"
                enabled={formData.status_views_enabled}
                weight={formData.status_views_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, status_views_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, status_views_weight: v }))
                }
              />

              {/* Reactions */}
              <ActionSlider
                label="Reacoes"
                enabled={formData.reactions_enabled}
                weight={formData.reactions_weight}
                onEnabledChange={(v) =>
                  setFormData((p) => ({ ...p, reactions_enabled: v }))
                }
                onWeightChange={(v) =>
                  setFormData((p) => ({ ...p, reactions_weight: v }))
                }
              />
            </div>
          </TabsContent>

          {/* Limits Tab */}
          <TabsContent value="limites" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Limites diarios por instancia para evitar bloqueios
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mensagens/dia</Label>
                <Input
                  type="number"
                  value={formData.max_messages_per_day}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_messages_per_day: parseInt(e.target.value) || 50,
                    }))
                  }
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Audios/dia</Label>
                <Input
                  type="number"
                  value={formData.max_audio_per_day}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_audio_per_day: parseInt(e.target.value) || 10,
                    }))
                  }
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Midias/dia</Label>
                <Input
                  type="number"
                  value={formData.max_media_per_day}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_media_per_day: parseInt(e.target.value) || 10,
                    }))
                  }
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Status/dia</Label>
                <Input
                  type="number"
                  value={formData.max_status_per_day}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_status_per_day: parseInt(e.target.value) || 5,
                    }))
                  }
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Reacoes/dia</Label>
                <Input
                  type="number"
                  value={formData.max_reactions_per_day}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_reactions_per_day: parseInt(e.target.value) || 20,
                    }))
                  }
                  min={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Digitando Min (seg)</Label>
                <Input
                  type="number"
                  value={formData.min_typing_duration}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_typing_duration: parseInt(e.target.value) || 2,
                    }))
                  }
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Digitando Max (seg)</Label>
                <Input
                  type="number"
                  value={formData.max_typing_duration}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_typing_duration: parseInt(e.target.value) || 15,
                    }))
                  }
                  min={2}
                />
              </div>
            </div>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ia" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Usar IA para Conversas</Label>
                <p className="text-xs text-muted-foreground">
                  Gera mensagens naturais usando Claude Haiku
                </p>
              </div>
              <Switch
                checked={formData.use_ai_conversations}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    use_ai_conversations: checked,
                  }))
                }
              />
            </div>

            {formData.use_ai_conversations && (
              <>
                <div className="space-y-2">
                  <Label>Topicos de Conversa</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder="Ex: futebol, trabalho..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTopic();
                        }
                      }}
                    />
                    <Button type="button" onClick={addTopic} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.ai_topics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.ai_topics.map((topic) => (
                        <Badge key={topic} variant="secondary" className="gap-1">
                          {topic}
                          <button
                            type="button"
                            onClick={() => removeTopic(topic)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tom das Conversas</Label>
                  <Select
                    value={formData.ai_tone}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, ai_tone: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_TONES.map((tone) => (
                        <SelectItem key={tone.value} value={tone.value}>
                          {tone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-400">
                    Custo estimado: ~R$0,01 por 100 mensagens com IA
                  </p>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Configuracao"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Action Slider Component
function ActionSlider({
  label,
  enabled,
  weight,
  onEnabledChange,
  onWeightChange,
}: {
  label: string;
  enabled: boolean;
  weight: number;
  onEnabledChange: (enabled: boolean) => void;
  onWeightChange: (weight: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox checked={enabled} onCheckedChange={onEnabledChange} />
      <span className={`w-32 text-sm ${!enabled && "text-muted-foreground"}`}>
        {label}
      </span>
      <div className="flex-1">
        <Slider
          value={[weight]}
          onValueChange={([v]) => onWeightChange(v)}
          max={100}
          step={5}
          disabled={!enabled}
          className="flex-1"
        />
      </div>
      <span className="w-8 text-sm text-muted-foreground text-right">
        {weight}
      </span>
    </div>
  );
}
