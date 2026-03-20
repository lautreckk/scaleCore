import { SupabaseClient } from "@supabase/supabase-js";
import { CURATED_MODELS } from "./models";

export async function checkAndDebitWallet(
  supabase: SupabaseClient,
  tenantId: string,
  modelId: string
): Promise<{ allowed: boolean; cost: number }> {
  const model = CURATED_MODELS.find((m) => m.id === modelId);
  const cost = model?.creditsPerMessage ?? 1;

  // Check balance first
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("tenant_id", tenantId)
    .single();

  if (!wallet || (wallet.balance ?? 0) < cost) {
    console.log(
      `[Billing] Insufficient balance for tenant ${tenantId}: ${wallet?.balance ?? 0} < ${cost}`
    );
    return { allowed: false, cost };
  }

  // Debit atomically via existing RPC
  const { data: success } = await supabase.rpc("deduct_wallet_balance", {
    p_tenant_id: tenantId,
    p_amount: cost,
    p_description: `AI Agent: mensagem processada (${model?.name || modelId})`,
  });

  return { allowed: success !== false, cost };
}
