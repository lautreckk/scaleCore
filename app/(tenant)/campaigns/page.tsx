"use client";

import { CampaignsTable } from "@/components/campaigns/campaigns-table";

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campanhas</h1>
        <p className="text-muted-foreground">
          Envie mensagens em massa para seus leads
        </p>
      </div>

      <CampaignsTable />
    </div>
  );
}
