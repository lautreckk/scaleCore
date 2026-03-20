"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { agentFormSchema, type AgentFormData, slugifyTag } from "@/lib/agents/validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ModelSelector } from "@/components/agents/model-selector";
import { InstanceSelector } from "@/components/agents/instance-selector";
import { DeleteDialog } from "@/components/agents/delete-dialog";
import { BulkTagDialog } from "@/components/agents/bulk-tag-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AgentFormProps {
  mode: "create" | "edit";
  agentId?: string;
  defaultValues?: Partial<AgentFormData>;
}

export function AgentForm({ mode, agentId, defaultValues }: AgentFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [bulkTagCount, setBulkTagCount] = useState(0);
  const [applyingTags, setApplyingTags] = useState(false);
  const savedAgentIdRef = useRef<string | null>(agentId ?? null);

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: "",
      system_prompt: "",
      model_id: "",
      activation_tag: "",
      tag_apply_mode: "new_only",
      instance_ids: [],
      is_active: true,
      ...defaultValues,
    },
  });

  const tagValue = form.watch("activation_tag");
  const tagSlug = tagValue ? slugifyTag(tagValue) : "";

  const onSubmit = async (data: AgentFormData) => {
    setSubmitting(true);

    // Slugify the tag before submitting
    const submitData = {
      ...data,
      activation_tag: slugifyTag(data.activation_tag),
    };

    try {
      const url =
        mode === "create" ? "/api/agents" : `/api/agents/${agentId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      if (res.status === 409) {
        form.setError("activation_tag", {
          message:
            "Essa tag ja esta sendo usada por outro agente. Escolha uma tag diferente.",
        });
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      const result = await res.json();
      const savedAgentId = result.data?.id || agentId;
      savedAgentIdRef.current = savedAgentId;

      toast.success(
        mode === "create"
          ? "Agente criado com sucesso"
          : "Agente atualizado com sucesso"
      );

      // If tag_apply_mode is "all_existing", fetch count and show bulk tag dialog
      if (submitData.tag_apply_mode === "all_existing" && savedAgentId) {
        try {
          const countRes = await fetch(`/api/agents/${savedAgentId}/tags`);
          if (countRes.ok) {
            const countData = await countRes.json();
            if (countData.count > 0) {
              setBulkTagCount(countData.count);
              setShowBulkTagDialog(true);
              setSubmitting(false);
              return; // Don't redirect yet, wait for dialog
            }
          }
        } catch {
          // If count fetch fails, just redirect
        }
      }

      router.push("/agentes");
    } catch {
      toast.error(
        "Erro ao salvar agente. Verifique os campos e tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkTagConfirm = async () => {
    const targetId = savedAgentIdRef.current;
    if (!targetId) {
      router.push("/agentes");
      return;
    }

    setApplyingTags(true);
    try {
      const res = await fetch(`/api/agents/${targetId}/tags`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Tag aplicada em ${data.affected} chats`);
      } else {
        toast.error("Erro ao aplicar tags");
      }
    } catch {
      toast.error("Erro ao aplicar tags");
    } finally {
      setApplyingTags(false);
      setShowBulkTagDialog(false);
      router.push("/agentes");
    }
  };

  const handleDelete = async () => {
    if (!agentId) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete");
      }

      toast.success("Agente excluido com sucesso");
      router.push("/agentes");
    } catch {
      toast.error("Erro ao excluir agente");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-w-[42rem] mx-auto space-y-8"
        >
          {/* Active toggle (edit mode only) */}
          {mode === "edit" && (
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <Label>Agente ativo</Label>
                </div>
              )}
            />
          )}

          {/* Section 1: Informacoes Basicas */}
          <div className="space-y-4">
            <h2 className="text-lg">Informacoes Basicas</h2>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Agente</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: Bot Vendas"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="system_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt do Sistema</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva como o agente deve se comportar..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Section 2: Modelo LLM */}
          <div className="space-y-4">
            <h2 className="text-lg">Modelo LLM</h2>

            <FormField
              control={form.control}
              name="model_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <ModelSelector
                      value={field.value}
                      onChange={field.onChange}
                      disabled={submitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Section 3: Tag de Ativacao */}
          <div className="space-y-4">
            <h2 className="text-lg">Tag de Ativacao</h2>

            <FormField
              control={form.control}
              name="activation_tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tag</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="ex: bot-vendas"
                      />
                      <p className="text-xs text-muted-foreground">
                        Apenas letras minusculas, numeros e hifens
                      </p>
                      {tagSlug && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Preview:
                          </span>
                          <Badge variant="outline">{tagSlug}</Badge>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tag_apply_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aplicar tag em</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="new_only" id="new_only" />
                        <Label htmlFor="new_only">Apenas novos chats</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="all_existing"
                          id="all_existing"
                        />
                        <Label htmlFor="all_existing">
                          Todos os chats existentes
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Section 4: Instancias WhatsApp */}
          <div className="space-y-4">
            <h2 className="text-lg">Instancias WhatsApp</h2>

            <FormField
              control={form.control}
              name="instance_ids"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <InstanceSelector
                      selectedIds={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Section 5: Acoes */}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {submitting ? "Salvando..." : "Salvar Agente"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/agentes")}
            >
              Cancelar
            </Button>

            {mode === "edit" && (
              <Button
                type="button"
                variant="outline"
                className="ml-auto text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowDeleteDialog(true)}
              >
                Excluir Agente
              </Button>
            )}
          </div>
        </form>
      </Form>

      {/* Delete Dialog */}
      {mode === "edit" && (
        <DeleteDialog
          agentName={form.getValues("name")}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {/* Bulk Tag Dialog */}
      <BulkTagDialog
        tag={tagSlug}
        count={bulkTagCount}
        open={showBulkTagDialog}
        onOpenChange={(open) => {
          setShowBulkTagDialog(open);
          if (!open) {
            router.push("/agentes");
          }
        }}
        onConfirm={handleBulkTagConfirm}
        loading={applyingTags}
      />
    </>
  );
}
