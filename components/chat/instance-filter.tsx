"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Instance {
  id: string;
  name: string;
  color: string | null;
}

interface InstanceFilterProps {
  instances: Instance[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string | null) => void;
}

export function InstanceFilter({
  instances,
  selectedInstanceId,
  onSelect,
}: InstanceFilterProps) {
  return (
    <Select
      value={selectedInstanceId || "all"}
      onValueChange={(value) => onSelect(value === "all" ? null : value)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Todas as instancias" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 via-green-500 to-red-500" />
            Todas as instancias
          </div>
        </SelectItem>
        {instances.map((instance) => (
          <SelectItem key={instance.id} value={instance.id}>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: instance.color || "#DC2626" }}
              />
              {instance.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
