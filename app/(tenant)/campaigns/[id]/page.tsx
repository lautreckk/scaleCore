"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampaignMonitor } from "@/components/campaigns/campaign-monitor";
import { ArrowLeft } from "lucide-react";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>

      {/* Campaign Monitor */}
      <CampaignMonitor campaignId={id} />
    </div>
  );
}
