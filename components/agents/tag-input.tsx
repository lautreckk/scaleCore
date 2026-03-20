"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { slugifyTag } from "@/lib/agents/validation";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TagInput({ value, onChange, error }: TagInputProps) {
  const slug = value ? slugifyTag(value) : "";

  return (
    <div className="space-y-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ex: bot-vendas"
        className={error ? "border-destructive" : ""}
      />
      <p className="text-xs text-muted-foreground">
        Apenas letras minusculas, numeros e hifens
      </p>
      {slug && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <Badge variant="outline">{slug}</Badge>
        </div>
      )}
    </div>
  );
}
