"use client";

import { cn } from "@/lib/utils";

interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();

    if (isSameDay(d, now)) return "Hoje";
    if (isSameDay(d, yesterday)) return "Ontem";

    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1.5 rounded-lg">
        {formatDate(date)}
      </div>
    </div>
  );
}
