"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentCard, type AgentWithInstances } from "@/components/agents/agent-card";
import { Bot, Plus } from "lucide-react";

export default function AgentesPage() {
  const [agents, setAgents] = useState<AgentWithInstances[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadAgents = async () => {
    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setAgents(data.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleToggle = (id: string, isActive: boolean) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_active: isActive } : a))
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Bot className="h-7 w-7 text-white" />
          <h1 className="text-2xl font-bold text-white">Agentes IA</h1>
        </div>
        <Link href="/agentes/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Criar Agente
          </Button>
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[160px] rounded-xl" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-4">
            Erro ao carregar agentes. Tente novamente.
          </p>
          <Button variant="outline" onClick={loadAgents}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">
            Nenhum agente criado
          </h2>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            Crie seu primeiro agente IA para responder leads automaticamente no
            WhatsApp.
          </p>
          <Link href="/agentes/novo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Agente
            </Button>
          </Link>
        </div>
      )}

      {/* Agent grid */}
      {!loading && !error && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
