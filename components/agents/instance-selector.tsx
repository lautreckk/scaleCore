"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

interface Instance {
  id: string;
  name: string;
  phone_number: string | null;
  status: string | null;
}

interface InstanceSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function InstanceSelector({
  selectedIds,
  onChange,
}: InstanceSelectorProps) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInstances = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, name, phone_number, status")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("name");

      setInstances(data ?? []);
      setLoading(false);
    };

    loadInstances();
  }, []);

  const handleToggle = (instanceId: string) => {
    if (selectedIds.includes(instanceId)) {
      onChange(selectedIds.filter((id) => id !== instanceId));
    } else {
      onChange([...selectedIds, instanceId]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 bg-secondary/50 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma instancia conectada. Conecte uma instancia nas configuracoes.
      </p>
    );
  }

  const content = (
    <div className="space-y-3">
      {instances.map((instance) => {
        const isConnected =
          instance.status === "open" || instance.status === "connected";

        return (
          <div
            key={instance.id}
            className="flex items-center gap-3 py-1"
          >
            <Checkbox
              id={`instance-${instance.id}`}
              checked={selectedIds.includes(instance.id)}
              onCheckedChange={() => handleToggle(instance.id)}
            />
            <Label
              htmlFor={`instance-${instance.id}`}
              className="flex items-center gap-2 cursor-pointer font-normal flex-1"
            >
              <span className="text-sm text-white">{instance.name}</span>
              {instance.phone_number && (
                <span className="text-xs text-muted-foreground">
                  {instance.phone_number}
                </span>
              )}
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-gray-500"
                }`}
              />
            </Label>
          </div>
        );
      })}
    </div>
  );

  if (instances.length > 4) {
    return <ScrollArea className="max-h-[240px]">{content}</ScrollArea>;
  }

  return content;
}
