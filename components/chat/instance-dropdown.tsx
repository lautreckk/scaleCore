"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface InstanceWithUnread {
  id: string;
  name: string;
  color: string | null;
  unreadCount: number;
}

interface InstanceDropdownProps {
  instances: InstanceWithUnread[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string | null) => void;
  totalUnread: number;
}

export function InstanceDropdown({
  instances,
  selectedInstanceId,
  onSelect,
  totalUnread,
}: InstanceDropdownProps) {
  const selectedInstance = instances.find((i) => i.id === selectedInstanceId);

  return (
    <Select
      value={selectedInstanceId || "all"}
      onValueChange={(value) => onSelect(value === "all" ? null : value)}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {selectedInstanceId && selectedInstance ? (
                <>
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedInstance.color || "#DC2626" }}
                  />
                  <span className="truncate">{selectedInstance.name}</span>
                </>
              ) : (
                <>
                  <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 via-green-500 to-red-500 flex-shrink-0" />
                  <span>Todas as instancias</span>
                </>
              )}
            </div>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center justify-between w-full min-w-[200px]">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 via-green-500 to-red-500" />
              <span>Todas as instancias</span>
            </div>
            {totalUnread > 0 && (
              <span className="ml-2 h-5 min-w-[20px] rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center px-1.5">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
        </SelectItem>
        {instances.map((instance) => (
          <SelectItem key={instance.id} value={instance.id}>
            <div className="flex items-center justify-between w-full min-w-[200px]">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: instance.color || "#DC2626" }}
                />
                <span>{instance.name}</span>
              </div>
              {instance.unreadCount > 0 && (
                <span className="ml-2 h-5 min-w-[20px] rounded-full bg-primary text-white text-xs font-medium flex items-center justify-center px-1.5">
                  {instance.unreadCount > 99 ? "99+" : instance.unreadCount}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
