"use client";

import { AgentForm } from "@/components/agents/agent-form";

export default function NovoAgentePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-8">Novo Agente</h1>
      <AgentForm mode="create" />
    </div>
  );
}
