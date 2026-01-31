"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MoreHorizontal,
  Play,
  Pause,
  Eye,
  Trash2,
  Send,
  Check,
  X,
  Clock,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  status: string;
  tags: string[] | null;
  total_recipients: number | null;
  sent_count: number | null;
  delivered_count: number | null;
  read_count: number | null;
  failed_count: number | null;
  message_count: number;
  created_at: string;
  whatsapp_instances: {
    id: string;
    instance_name: string;
    status: string;
  } | null;
}

export function CampaignsTable() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

  const supabase = createClient();

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns");
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Real-time updates
    const channel = supabase
      .channel("campaigns-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => fetchCampaigns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleStart = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: "POST",
      });
      if (response.ok) {
        fetchCampaigns();
      } else {
        const error = await response.json();
        console.error("Error starting campaign:", error);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: "POST",
      });
      if (response.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;

    setActionLoading(campaignToDelete);
    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaignToDelete);

      if (!error) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; icon?: React.ReactNode }
    > = {
      draft: { variant: "outline" },
      scheduled: { variant: "secondary", icon: <Clock className="h-3 w-3 mr-1" /> },
      running: {
        variant: "default",
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      },
      paused: { variant: "outline", icon: <Pause className="h-3 w-3 mr-1" /> },
      completed: { variant: "secondary", icon: <Check className="h-3 w-3 mr-1" /> },
      failed: { variant: "destructive", icon: <X className="h-3 w-3 mr-1" /> },
    };

    const { variant, icon } = config[status] || { variant: "outline" as const };

    return (
      <Badge variant={variant} className="capitalize">
        {icon}
        {status}
      </Badge>
    );
  };

  const getProgressBar = (campaign: Campaign) => {
    const total = campaign.total_recipients || 0;
    const processed = (campaign.sent_count || 0) + (campaign.failed_count || 0);
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

    if (total === 0) return null;

    return (
      <div className="w-24">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-1 text-center">
          {percent}%
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Campanhas</CardTitle>
              <CardDescription>
                Gerencie suas campanhas de WhatsApp
              </CardDescription>
            </div>
            <Button onClick={() => router.push("/campaigns/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Nenhuma campanha</h3>
              <p className="text-muted-foreground mt-1">
                Crie sua primeira campanha para começar a enviar mensagens
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push("/campaigns/new")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Campanha
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Progresso</th>
                    <th className="pb-3 font-medium text-center">Dest.</th>
                    <th className="pb-3 font-medium text-center">
                      <Send className="h-4 w-4 inline text-green-500" />
                    </th>
                    <th className="pb-3 font-medium text-center">
                      <X className="h-4 w-4 inline text-red-500" />
                    </th>
                    <th className="pb-3 font-medium text-center">Msgs</th>
                    <th className="pb-3 font-medium">Criada</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/campaigns/${campaign.id}`)}
                    >
                      <td className="py-4">
                        <div className="font-medium">{campaign.name}</div>
                        {campaign.tags && campaign.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {campaign.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4">{getStatusBadge(campaign.status)}</td>
                      <td className="py-4">{getProgressBar(campaign)}</td>
                      <td className="py-4 text-center">
                        {campaign.total_recipients || 0}
                      </td>
                      <td className="py-4 text-center text-green-600">
                        {campaign.sent_count || 0}
                      </td>
                      <td className="py-4 text-center text-red-600">
                        {campaign.failed_count || 0}
                      </td>
                      <td className="py-4 text-center">
                        {campaign.message_count || 1}
                      </td>
                      <td className="py-4 text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(campaign.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </td>
                      <td className="py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {actionLoading === campaign.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/campaigns/${campaign.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>

                            {["draft", "paused"].includes(campaign.status) && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStart(campaign.id);
                                }}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Iniciar
                              </DropdownMenuItem>
                            )}

                            {campaign.status === "running" && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePause(campaign.id);
                                }}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCampaignToDelete(campaign.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados da campanha serão
              perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
