"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  Loader2,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
} from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  reference_id: string | null;
}

interface WalletData {
  id: string;
  balance: number;
  reserved_balance: number;
}

export default function BillingPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    const [walletResult, transactionsResult] = await Promise.all([
      supabase
        .from("wallets")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .single(),
      supabase
        .from("transactions")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (walletResult.data) {
      setWallet(walletResult.data);
    }

    if (transactionsResult.data) {
      setTransactions(transactionsResult.data);
    }

    setLoading(false);
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case "credit":
        return <Badge variant="success">Crédito</Badge>;
      case "debit":
        return <Badge variant="destructive">Débito</Badge>;
      case "refund":
        return <Badge variant="warning">Reembolso</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Disponível
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(wallet?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponível para envio de mensagens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Reservado
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(wallet?.reserved_balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Reservado para campanhas ativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Credits */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Créditos</CardTitle>
          <CardDescription>
            Adicione créditos para enviar mensagens pelo WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { amount: 50, bonus: 0 },
              { amount: 100, bonus: 10 },
              { amount: 200, bonus: 30 },
            ].map((plan) => (
              <div
                key={plan.amount}
                className="p-4 rounded-lg border border-border hover:border-primary transition-colors cursor-pointer"
                onClick={() => toast.info("Integração com gateway de pagamento pendente")}
              >
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(plan.amount)}
                </p>
                {plan.bonus > 0 && (
                  <p className="text-sm text-green-500">
                    +{formatCurrency(plan.bonus)} de bônus
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  ~{Math.floor((plan.amount + plan.bonus) / 0.12)} mensagens
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Custo por mensagem: R$ 0,12
          </p>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>
            Últimas movimentações da sua carteira
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Nenhuma transação encontrada
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        transaction.type === "credit"
                          ? "bg-green-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {transaction.type === "credit" ? (
                        <ArrowDownRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(transaction.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium ${
                        transaction.type === "credit"
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {transaction.type === "credit" ? "+" : "-"}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </p>
                    {getTransactionBadge(transaction.type)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
