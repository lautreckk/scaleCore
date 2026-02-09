"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendTestMessage, createTestTemplate } from "@/actions/meta-review";
import {
  MessageSquare,
  FileText,
  Webhook,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
} from "lucide-react";

type Result = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
} | null;

export default function MetaApprovalPage() {
  // Message tab state
  const [phone, setPhone] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageResult, setMessageResult] = useState<Result>(null);

  // Template tab state
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateResult, setTemplateResult] = useState<Result>(null);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    setSendingMessage(true);
    setMessageResult(null);

    const result = await sendTestMessage(phone, messageText);
    setMessageResult(result);
    setSendingMessage(false);
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTemplate(true);
    setTemplateResult(null);

    const result = await createTestTemplate(templateName, templateContent);
    setTemplateResult(result);
    setCreatingTemplate(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Meta App Review</h1>
        <p className="text-muted-foreground mt-1">
          Ferramentas para gravar os videos de validacao da WhatsApp Cloud API
        </p>
      </div>

      <Tabs defaultValue="message" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="message" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagem
          </TabsTrigger>
          <TabsTrigger value="template" className="gap-2">
            <FileText className="h-4 w-4" />
            Template
          </TabsTrigger>
          <TabsTrigger value="webhook" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhook
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Send Message */}
        <TabsContent value="message">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensagem de Teste</CardTitle>
              <CardDescription>
                Envia uma mensagem de texto via WhatsApp Cloud API (Video 1)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Numero do Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="5511999999999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    Formato internacional sem + (ex: 5511999999999)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    placeholder="Ola! Esta e uma mensagem de teste."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    required
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sendingMessage}
                  className="w-full"
                >
                  {sendingMessage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Mensagem"
                  )}
                </Button>

                <ResultDisplay result={messageResult} />
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Create Template */}
        <TabsContent value="template">
          <Card>
            <CardHeader>
              <CardTitle>Criar Template de Mensagem</CardTitle>
              <CardDescription>
                Cria um template UTILITY em pt_BR na WhatsApp Cloud API (Video
                2)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Nome do Template</Label>
                  <Input
                    id="templateName"
                    placeholder="pedido_confirmado"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    Apenas letras minusculas e underscores (ex:
                    pedido_confirmado)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="templateContent">Conteudo do Template</Label>
                  <Textarea
                    id="templateContent"
                    placeholder="Ola! Seu pedido foi confirmado com sucesso."
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    required
                    rows={4}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={creatingTemplate}
                  className="w-full"
                >
                  {creatingTemplate ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Template"
                  )}
                </Button>

                <ResultDisplay result={templateResult} />
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Webhook Status */}
        <TabsContent value="webhook">
          <Card>
            <CardHeader>
              <CardTitle>Configuracao do Webhook</CardTitle>
              <CardDescription>
                Use estas informacoes no painel da Meta para configurar o webhook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted flex-1 rounded-md px-3 py-2 text-sm">
                    https://seudominio.com/api/webhooks/meta
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/api/webhooks/meta`
                      )
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Clique no botao para copiar a URL real do seu dominio
                </p>
              </div>

              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted flex-1 rounded-md px-3 py-2 text-sm">
                    sena_works_verify_2026
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard("sena_works_verify_2026")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-sm text-yellow-200">
                  <strong>Campos para assinar no webhook:</strong> Selecione{" "}
                  <code className="rounded bg-yellow-500/20 px-1">messages</code> no painel do
                  Facebook para receber notificacoes de mensagens recebidas e
                  status de entrega.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultDisplay({ result }: { result: Result }) {
  if (!result) return null;

  if (result.success) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-green-500/30 bg-green-500/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-300">Sucesso!</p>
          <pre className="text-muted-foreground mt-1 overflow-x-auto text-xs">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-4">
      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
      <div>
        <p className="text-sm font-medium text-red-300">Erro</p>
        <p className="text-muted-foreground mt-1 text-xs">{result.error}</p>
      </div>
    </div>
  );
}
