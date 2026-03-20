import { z } from "zod";

export const agentFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(100, "Nome deve ter no maximo 100 caracteres"),
  system_prompt: z.string().min(1, "Prompt do sistema e obrigatorio").max(10000, "Prompt deve ter no maximo 10000 caracteres"),
  model_id: z.string().min(1, "Selecione um modelo"),
  activation_tag: z.string()
    .min(1, "Tag de ativacao e obrigatoria")
    .max(50, "Tag deve ter no maximo 50 caracteres")
    .regex(/^[a-z0-9-]+$/, "Tag deve conter apenas letras minusculas, numeros e hifens"),
  tag_apply_mode: z.enum(["new_only", "all_existing"]).default("new_only"),
  instance_ids: z.array(z.string().uuid()).default([]),
  escalation_keywords: z.array(z.string().min(1).max(100)).default([]),
  is_active: z.boolean().default(true),
});

export type AgentFormData = z.infer<typeof agentFormSchema>;

export function slugifyTag(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
