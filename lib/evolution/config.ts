import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { createEvolutionClient, EvolutionApiClient } from "./client";

export interface EvolutionApiConfig {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  api_key_encrypted: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EvolutionApiConfigWithInstanceCount extends EvolutionApiConfig {
  instance_count: number;
}

export async function getEvolutionConfigs(
  tenantId: string
): Promise<EvolutionApiConfigWithInstanceCount[]> {
  const supabase = await createClient();

  const { data: configs, error } = await supabase
    .from("evolution_api_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching evolution configs:", error);
    return [];
  }

  // Get instance counts for each config
  const configsWithCounts = await Promise.all(
    (configs || []).map(async (config) => {
      const { count } = await supabase
        .from("whatsapp_instances")
        .select("*", { count: "exact", head: true })
        .eq("evolution_config_id", config.id);

      return {
        ...config,
        instance_count: count || 0,
      };
    })
  );

  return configsWithCounts;
}

export async function getEvolutionConfigById(
  configId: string
): Promise<EvolutionApiConfig | null> {
  const supabase = await createClient();

  const { data: config, error } = await supabase
    .from("evolution_api_configs")
    .select("*")
    .eq("id", configId)
    .single();

  if (error) {
    console.error("Error fetching evolution config:", error);
    return null;
  }

  return config;
}

export async function getEvolutionClientForInstance(
  instanceId: string
): Promise<EvolutionApiClient | null> {
  const supabase = await createClient();

  // Get the instance with its evolution config
  const { data: instance, error: instanceError } = await supabase
    .from("whatsapp_instances")
    .select("evolution_config_id")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.evolution_config_id) {
    console.error("Instance not found or no config associated:", instanceError);
    return null;
  }

  return getEvolutionClientForConfig(instance.evolution_config_id);
}

export async function getEvolutionClientForConfig(
  configId: string
): Promise<EvolutionApiClient | null> {
  const config = await getEvolutionConfigById(configId);

  if (!config) {
    return null;
  }

  try {
    const apiKey = decrypt(config.api_key_encrypted);
    return createEvolutionClient({
      url: config.url,
      apiKey,
    });
  } catch (error) {
    console.error("Error decrypting API key:", error);
    return null;
  }
}

export async function getEvolutionClientByInstanceName(
  instanceName: string,
  tenantId: string
): Promise<{ client: EvolutionApiClient; instance: { id: string; evolution_config_id: string } } | null> {
  const supabase = await createClient();

  // Get the instance with its evolution config
  const { data: instance, error: instanceError } = await supabase
    .from("whatsapp_instances")
    .select("id, evolution_config_id")
    .eq("instance_name", instanceName)
    .eq("tenant_id", tenantId)
    .single();

  if (instanceError || !instance?.evolution_config_id) {
    console.error("Instance not found or no config associated:", instanceError);
    return null;
  }

  const client = await getEvolutionClientForConfig(instance.evolution_config_id);

  if (!client) {
    return null;
  }

  return { client, instance };
}
