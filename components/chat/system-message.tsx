"use client";

interface SystemMessageProps {
  content: string;
  timestamp?: string;
}

export function SystemMessage({ content, timestamp }: SystemMessageProps) {
  return (
    <div className="flex items-center justify-center my-3">
      <div className="bg-muted/60 text-muted-foreground text-xs px-3 py-1.5 rounded-lg text-center max-w-[80%]">
        {content}
        {timestamp && (
          <span className="ml-2 opacity-70">
            {new Date(timestamp).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </span>
        )}
      </div>
    </div>
  );
}
