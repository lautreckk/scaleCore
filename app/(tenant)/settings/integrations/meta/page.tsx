"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Phone,
  Trash2,
  MessageSquare,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: {
            accessToken: string;
            code?: string;
          };
          status: string;
        }) => void,
        options: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          scope: string;
          extras: {
            feature: string;
            sessionInfoVersion: string;
          };
        }
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

interface MetaAccount {
  id: string;
  waba_id: string;
  phone_number_id: string | null;
  phone_number: string | null;
  name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function MetaIntegrationPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [fbReady, setFbReady] = useState(false);

  const supabase = createClient();

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/integrations/meta");
      const data = await response.json();
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error("Error loading Meta accounts:", error);
      toast.error("Erro ao carregar contas Meta");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Facebook SDK
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) {
      console.warn("NEXT_PUBLIC_META_APP_ID not configured");
      return;
    }

    // Check if SDK is already loaded
    if (window.FB) {
      setFbReady(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      setFbReady(true);
    };

    // Load SDK script
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const startEmbeddedSignup = () => {
    if (!window.FB) {
      toast.error("Facebook SDK ainda nao carregou. Tente novamente.");
      return;
    }

    setConnecting(true);

    window.FB.login(
      function (response) {
        if (response.authResponse) {
          const accessToken = response.authResponse.accessToken;
          saveAccount(accessToken);
        } else {
          setConnecting(false);
          toast.error("Login cancelado ou falhou.");
        }
      },
      {
        scope:
          "whatsapp_business_management,whatsapp_business_messaging",
        extras: {
          feature: "whatsapp_embedded_signup",
          sessionInfoVersion: "2",
        },
      }
    );
  };

  const saveAccount = async (accessToken: string) => {
    try {
      const response = await fetch("/api/settings/integrations/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao salvar conta");
      }

      toast.success("WhatsApp Oficial conectado com sucesso!");
      loadAccounts();
    } catch (error) {
      console.error("Error saving Meta account:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao conectar conta"
      );
    } finally {
      setConnecting(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm("Tem certeza que deseja desconectar esta conta?")) return;

    try {
      const response = await fetch(
        `/api/settings/integrations/meta?id=${accountId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Falha ao remover conta");
      }

      toast.success("Conta removida com sucesso");
      loadAccounts();
    } catch (error) {
      console.error("Error deleting Meta account:", error);
      toast.error("Erro ao remover conta");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONNECTED":
        return <Badge variant="success">Conectado</Badge>;
      default:
        return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/settings/integrations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Integrações
      </Link>

      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <CardTitle>WhatsApp Meta (Oficial)</CardTitle>
              <CardDescription>
                Conecte numeros oficiais do WhatsApp Business via Meta Embedded
                Signup
              </CardDescription>
            </div>
          </div>
          {!appId ? (
            <div className="text-sm text-yellow-500">
              Configure NEXT_PUBLIC_META_APP_ID no .env
            </div>
          ) : (
            <Button
              onClick={startEmbeddedSignup}
              disabled={connecting || !fbReady}
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Phone className="h-4 w-4 mr-2" />
              )}
              {connecting ? "Conectando..." : "Conectar WhatsApp Oficial"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!appId ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <ShieldCheck className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Configuracao necessaria
              </p>
              <p className="text-sm text-muted-foreground">
                Adicione a variavel <code className="text-primary">NEXT_PUBLIC_META_APP_ID</code> no seu arquivo .env para habilitar o Embedded Signup
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nenhuma conta oficial conectada
              </p>
              <p className="text-sm text-muted-foreground">
                Clique em &quot;Conectar WhatsApp Oficial&quot; para vincular sua conta via Facebook
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">
                          {account.name || `WABA ${account.waba_id}`}
                        </p>
                        {getStatusBadge(account.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.phone_number || "Numero nao disponivel"}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-muted-foreground">
                          WABA: {account.waba_id}
                        </p>
                        {account.phone_number_id && (
                          <p className="text-xs text-muted-foreground">
                            Phone ID: {account.phone_number_id}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className="font-medium text-white">Como funciona?</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Clique em &quot;Conectar WhatsApp Oficial&quot; para abrir o fluxo do Facebook
              </li>
              <li>
                Faca login com sua conta do Facebook Business
              </li>
              <li>
                Selecione ou crie uma conta WhatsApp Business (WABA)
              </li>
              <li>
                Vincule um numero de telefone verificado
              </li>
              <li>
                Os dados serao salvos automaticamente aqui
              </li>
            </ol>
            <p className="text-xs text-muted-foreground mt-4">
              Este fluxo utiliza o Embedded Signup oficial do Meta para conectar
              numeros do WhatsApp Business API de forma segura.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
