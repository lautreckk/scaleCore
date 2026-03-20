"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CURATED_MODELS } from "@/lib/agents/models";
import { toast } from "sonner";

interface AgentInstance {
  id: string;
  instance_id: string;
  whatsapp_instances: {
    id: string;
    name: string;
    phone_number: string | null;
    status: string | null;
  };
}

export interface AgentWithInstances {
  id: string;
  name: string;
  model_id: string;
  activation_tag: string;
  is_active: boolean;
  ai_agent_instances: AgentInstance[];
}

interface AgentCardProps {
  agent: AgentWithInstances;
  onToggle?: (id: string, isActive: boolean) => void;
}

export function AgentCard({ agent, onToggle }: AgentCardProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(agent.is_active);
  const [toggling, setToggling] = useState(false);

  const model = CURATED_MODELS.find((m) => m.id === agent.model_id);
  const instanceCount = agent.ai_agent_instances?.length ?? 0;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling) return;

    const newState = !isActive;
    setIsActive(newState); // optimistic update
    setToggling(true);

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newState }),
      });

      if (!res.ok) {
        throw new Error("Failed to update");
      }

      toast.success(
        newState ? "Agente ativado" : "Agente desativado"
      );
      onToggle?.(agent.id, newState);
    } catch {
      setIsActive(!newState); // revert
      toast.error("Erro ao atualizar agente");
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:bg-secondary/50 ${
        !isActive ? "opacity-60" : ""
      }`}
      onClick={() => router.push(`/agentes/${agent.id}`)}
    >
      <CardContent className="p-6">
        {/* Top row: name + toggle */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg text-white font-bold truncate pr-2">
            {agent.name}
          </h3>
          <div onClick={handleToggle}>
            <Switch checked={isActive} disabled={toggling} />
          </div>
        </div>

        {/* Middle row: model + tag badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {model && (
            <Badge variant="secondary" className="text-xs">
              {model.name}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {agent.activation_tag}
          </Badge>
          {!isActive && (
            <Badge variant="secondary" className="text-xs text-muted-foreground">
              Inativo
            </Badge>
          )}
        </div>

        {/* Bottom row: instance count */}
        <p className="text-sm text-muted-foreground">
          {instanceCount === 0
            ? "Nenhuma instancia"
            : instanceCount === 1
            ? "1 instancia"
            : `${instanceCount} instancias`}
        </p>
      </CardContent>
    </Card>
  );
}
