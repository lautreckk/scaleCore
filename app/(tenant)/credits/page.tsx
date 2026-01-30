"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime, MESSAGE_COST } from "@/lib/utils";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from "lucide-react";

interface Wallet {
  balance: number;
  total_spent: number;
  total_added: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function CreditsPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      // Get wallet
      const { data: walletData } = await supabase
        .from("wallets")
        .select("balance, total_spent, total_added")
        .eq("tenant_id", tenantUser.tenant_id)
        .single();

      setWallet(walletData);

      // Get transactions
      if (walletData) {
        const { data: walletRecord } = await supabase
          .from("wallets")
          .select("id")
          .eq("tenant_id", tenantUser.tenant_id)
          .single();

        if (walletRecord) {
          const { data: txData } = await supabase
            .from("transactions")
            .select("id, type, amount, description, created_at")
            .eq("wallet_id", walletRecord.id)
            .order("created_at", { ascending: false })
            .limit(50);

          setTransactions(txData || []);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const messagesAvailable = wallet ? Math.floor(wallet.balance / MESSAGE_COST) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Créditos</h1>
          <p className="text-muted-foreground">Gerencie seu saldo para envio de mensagens</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Créditos
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Disponível
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {formatCurrency(wallet?.balance || 0)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              ≈ {messagesAvailable.toLocaleString()} mensagens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Gasto
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(wallet?.total_spent || 0)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Adicionado
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(wallet?.total_added || 0)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Histórico total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Info */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-white">Custo por mensagem</h3>
              <p className="text-muted-foreground">
                Cada mensagem enviada custa <span className="text-primary font-medium">{formatCurrency(MESSAGE_COST)}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-elevated rounded animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Nenhuma transação registrada
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        tx.type === "credit"
                          ? "bg-green-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {tx.type === "credit" ? (
                        <ArrowDownRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {tx.description || (tx.type === "credit" ? "Crédito adicionado" : "Débito")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-medium ${
                      tx.type === "credit" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
