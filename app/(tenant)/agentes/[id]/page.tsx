"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AgentForm } from "@/components/agents/agent-form";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentFormData } from "@/lib/agents/validation";

export default function EditAgentePage() {
  const params = useParams();
  const id = params.id as string;
  const [defaultValues, setDefaultValues] = useState<Partial<AgentFormData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadAgent = async () => {
      try {
        const res = await fetch(`/api/agents/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        const agent = data.data;

        setDefaultValues({
          name: agent.name,
          system_prompt: agent.system_prompt,
          model_id: agent.model_id,
          activation_tag: agent.activation_tag,
          tag_apply_mode: agent.tag_apply_mode as "new_only" | "all_existing",
          instance_ids: (
            agent.ai_agent_instances as Array<{ instance_id: string }>
          ).map((ai) => ai.instance_id),
          is_active: agent.is_active,
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [id]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-8">Editar Agente</h1>

      {loading && (
        <div className="max-w-[42rem] mx-auto space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[120px] w-full" />
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            Erro ao carregar agente. Tente novamente.
          </p>
        </div>
      )}

      {!loading && !error && defaultValues && (
        <AgentForm mode="edit" agentId={id} defaultValues={defaultValues} />
      )}
    </div>
  );
}
