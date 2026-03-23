"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotionConfig {
  id: string;
  notion_database_id: string;
  api_key_masked: string;
  sync_enabled: boolean;
  sync_direction: string;
  sync_interval_minutes: number;
  stage_mapping: Record<string, string>;
  field_mapping: Record<string, string>;
  default_operation: string | null;
  default_responsible: string | null;
  last_sync_at: string | null;
}

interface KanbanStage {
  id: string;
  name: string;
  color: string;
}

interface KanbanBoard {
  id: string;
  name: string;
  kanban_stages: KanbanStage[];
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  leads_created: number;
  leads_updated: number;
  leads_skipped: number;
  errors: Array<{ lead_id: string; lead_name: string | null; error: string }>;
  started_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTION_STATUS_OPTIONS = [
  "Pesquisado",
  "Msg Enviada",
  "Respondeu",
  "Call Marcada",
  "Proposta Enviada",
  "Follow-up",
  "Fechado",
  "Perdido",
];

const SYNC_INTERVALS = [
  { value: "60", label: "1 hora" },
  { value: "180", label: "3 horas" },
  { value: "360", label: "6 horas" },
  { value: "720", label: "12 horas" },
  { value: "1440", label: "24 horas" },
];

const SYNC_DIRECTIONS = [
  { value: "scalecore_to_notion", label: "ScaleCore → Notion" },
  { value: "notion_to_scalecore", label: "Notion → ScaleCore" },
  { value: "bidirectional", label: "Bidirecional" },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function NotionIntegrationPage() {
  // Connection state
  const [apiKey, setApiKey] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [config, setConfig] = useState<NotionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [notionProperties, setNotionProperties] = useState<string[]>([]);
  const [dbName, setDbName] = useState<string | null>(null);

  // Stage mapping
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [stages, setStages] = useState<KanbanStage[]>([]);
  const [stageMapping, setStageMapping] = useState<Record<string, string>>({});
  const [customStatuses, setCustomStatuses] = useState<Record<string, string>>({});

  // Defaults
  const [defaultOperation, setDefaultOperation] = useState("");
  const [defaultResponsible, setDefaultResponsible] = useState("");

  // Control
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState("360");
  const [syncDirection, setSyncDirection] = useState("scalecore_to_notion");
  const [syncing, setSyncing] = useState(false);

  // Logs
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Load data
  // -------------------------------------------------------------------------

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/notion/config");
      const data = await res.json();
      if (data.config) {
        const c = data.config as NotionConfig;
        setConfig(c);
        setDatabaseId(c.notion_database_id);
        setSyncEnabled(c.sync_enabled);
        setSyncDirection(c.sync_direction);
        setSyncInterval(String(c.sync_interval_minutes));
        setStageMapping(c.stage_mapping ?? {});
        setDefaultOperation(c.default_operation ?? "");
        setDefaultResponsible(c.default_responsible ?? "");
        setConnectionOk(true);
      }
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBoards = useCallback(async () => {
    try {
      const res = await fetch("/api/kanban/boards");
      const data = await res.json();
      if (Array.isArray(data)) {
        setBoards(data);
        // Flatten all stages
        const allStages: KanbanStage[] = [];
        for (const board of data) {
          if (board.kanban_stages) {
            allStages.push(...board.kanban_stages);
          }
        }
        setStages(allStages);
      }
    } catch (error) {
      console.error("Error loading boards:", error);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/integrations/notion/logs");
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadBoards();
    loadLogs();
  }, [loadConfig, loadBoards, loadLogs]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const testConnection = async () => {
    setTesting(true);
    setConnectionOk(null);
    try {
      const res = await fetch("/api/integrations/notion/test", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setConnectionOk(true);
        setNotionProperties(data.properties ?? []);
        setDbName(data.database_name);
        toast.success(`Conectado: ${data.database_name}`);
      } else {
        setConnectionOk(false);
        toast.error(data.error || "Falha na conexao");
      }
    } catch {
      setConnectionOk(false);
      toast.error("Erro ao testar conexao");
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    if (!databaseId) {
      toast.error("Database ID e obrigatorio");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        notion_database_id: databaseId,
        sync_enabled: syncEnabled,
        sync_direction: syncDirection,
        sync_interval_minutes: parseInt(syncInterval),
        stage_mapping: stageMapping,
        field_mapping: {},
        default_operation: defaultOperation || null,
        default_responsible: defaultResponsible || null,
      };

      if (apiKey) {
        payload.notion_api_key = apiKey;
      }

      const res = await fetch("/api/integrations/notion/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao salvar");
      }

      toast.success("Configuracao salva com sucesso");
      setApiKey(""); // Clear raw key after save
      await loadConfig();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao salvar configuracao"
      );
    } finally {
      setSaving(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/notion/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao iniciar sync");
      }

      toast.success("Sincronizacao iniciada! Acompanhe no historico.");
      // Poll logs after a few seconds
      setTimeout(() => loadLogs(), 5000);
      setTimeout(() => loadLogs(), 15000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao sincronizar"
      );
    } finally {
      setSyncing(false);
    }
  };

  const updateStageMapping = (stageId: string, notionStatus: string) => {
    setStageMapping((prev) => ({
      ...prev,
      [stageId]: notionStatus,
    }));
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="success">Sucesso</Badge>;
      case "partial":
        return <Badge variant="warning">Parcial</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "running":
        return <Badge variant="secondary">Executando</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("pt-BR");
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/settings/integrations"
          className="text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-white">Integracao Notion</h2>
          <p className="text-sm text-muted-foreground">
            Sincronize seus leads e kanban com o Notion
          </p>
        </div>
      </div>

      {/* Section 1 — Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Conexao</CardTitle>
          <CardDescription>
            Configure a API Key e Database ID do seu Notion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Notion API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={config?.api_key_masked || "ntn_xxxxxxxxxxxx"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {config?.api_key_masked && (
              <p className="text-xs text-muted-foreground">
                Chave atual: {config.api_key_masked} — deixe vazio para manter
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="database-id">Database ID</Label>
            <Input
              id="database-id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Abra sua database no Notion → Copie o ID da URL:
              notion.so/<strong>DATABASE_ID</strong>?v=...
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Conexao
            </Button>

            {connectionOk === true && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">
                  Conectado{dbName ? `: ${dbName}` : ""}
                </span>
              </div>
            )}
            {connectionOk === false && (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  Falha na conexao
                </span>
              </div>
            )}
          </div>

          {notionProperties.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Colunas encontradas na database:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {notionProperties.map((prop) => (
                  <Badge key={prop} variant="secondary" className="text-xs">
                    {prop}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — Stage Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Mapeamento de Stages</CardTitle>
          <CardDescription>
            Vincule os stages do Kanban aos status do Notion
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum board Kanban encontrado. Crie um board primeiro.
            </p>
          ) : (
            <div className="space-y-3">
              {boards.map((board) => (
                <div key={board.id}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {board.name}
                  </p>
                  <div className="space-y-2">
                    {(board.kanban_stages || []).map((stage) => (
                      <div
                        key={stage.id}
                        className="flex items-center gap-3 p-2 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-sm text-white">
                            {stage.name}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-sm">→</span>
                        <div className="flex-1 flex items-center gap-2">
                          <Select
                            value={stageMapping[stage.id] || ""}
                            onValueChange={(v) =>
                              v === "__custom__"
                                ? updateStageMapping(stage.id, "")
                                : updateStageMapping(stage.id, v)
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecione status Notion" />
                            </SelectTrigger>
                            <SelectContent>
                              {NOTION_STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                              <SelectItem value="__custom__">
                                Personalizado...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {stageMapping[stage.id] === "" && (
                            <Input
                              placeholder="Status personalizado"
                              className="flex-1"
                              value={customStatuses[stage.id] || ""}
                              onChange={(e) => {
                                setCustomStatuses((prev) => ({
                                  ...prev,
                                  [stage.id]: e.target.value,
                                }));
                                updateStageMapping(stage.id, e.target.value);
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Valores Padrao</CardTitle>
          <CardDescription>
            Campos preenchidos automaticamente em todos os leads sincronizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-operation">Operacao Padrao</Label>
              <Input
                id="default-operation"
                placeholder="Ex: JB/Trono"
                value={defaultOperation}
                onChange={(e) => setDefaultOperation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-responsible">Responsavel Padrao</Label>
              <Input
                id="default-responsible"
                placeholder="Ex: Equipe Vendas"
                value={defaultResponsible}
                onChange={(e) => setDefaultResponsible(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 — Control */}
      <Card>
        <CardHeader>
          <CardTitle>Controle de Sincronizacao</CardTitle>
          <CardDescription>
            Configure quando e como a sincronizacao acontece
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                Sync Automatico
              </p>
              <p className="text-xs text-muted-foreground">
                Sincronizar automaticamente via cron
              </p>
            </div>
            <Switch
              checked={syncEnabled}
              onCheckedChange={setSyncEnabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Intervalo</Label>
              <Select value={syncInterval} onValueChange={setSyncInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_INTERVALS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direcao</Label>
              <Select value={syncDirection} onValueChange={setSyncDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_DIRECTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {config?.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Ultima sincronizacao: {formatDate(config.last_sync_at)}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={saveConfig} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Configuracao
            </Button>
            <Button
              variant="outline"
              onClick={triggerSync}
              disabled={syncing || !config}
            >
              {syncing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sincronizar Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 5 — Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historico de Sincronizacoes</CardTitle>
            <CardDescription>Ultimas 20 execucoes</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            <RefreshCw
              className={`h-4 w-4 ${loadingLogs ? "animate-spin" : ""}`}
            />
          </Button>
        </CardHeader>
        <CardContent>
          {loadingLogs && logs.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma sincronizacao realizada ainda
            </p>
          ) : (
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-7 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                <span className="col-span-2">Data</span>
                <span>Tipo</span>
                <span>Status</span>
                <span className="text-center">Criados</span>
                <span className="text-center">Atualizados</span>
                <span className="text-center">Erros</span>
              </div>

              {/* Rows */}
              {logs.map((log) => (
                <div key={log.id}>
                  <div
                    className="grid grid-cols-7 gap-2 px-3 py-2 text-sm items-center rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() =>
                      setExpandedLog(
                        expandedLog === log.id ? null : log.id
                      )
                    }
                  >
                    <span className="col-span-2 text-white flex items-center gap-1">
                      {log.errors && log.errors.length > 0 ? (
                        expandedLog === log.id ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )
                      ) : (
                        <span className="w-3" />
                      )}
                      {formatDate(log.started_at)}
                    </span>
                    <span className="text-muted-foreground capitalize">
                      {log.sync_type}
                    </span>
                    <span>{getStatusBadge(log.status)}</span>
                    <span className="text-center text-green-400">
                      {log.leads_created}
                    </span>
                    <span className="text-center text-blue-400">
                      {log.leads_updated}
                    </span>
                    <span className="text-center text-red-400">
                      {log.errors?.length || 0}
                    </span>
                  </div>

                  {/* Expanded errors */}
                  {expandedLog === log.id &&
                    log.errors &&
                    log.errors.length > 0 && (
                      <div className="ml-8 mb-2 p-3 rounded-lg border border-border bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Detalhes dos erros:
                        </p>
                        <div className="space-y-1">
                          {log.errors.map((err, i) => (
                            <div
                              key={i}
                              className="text-xs text-red-400"
                            >
                              <span className="text-muted-foreground">
                                {err.lead_name || err.lead_id}:
                              </span>{" "}
                              {err.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
