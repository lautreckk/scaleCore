"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

const VERSION_KEY = "app_version";
const CHECK_INTERVAL = 60000; // Check every 60 seconds

export function UpdateChecker() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch the current build ID from the API
      const response = await fetch("/api/version", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const serverVersion = data.version;

      // Get stored version
      const storedVersion = localStorage.getItem(VERSION_KEY);

      if (!storedVersion) {
        // First visit, store the version
        localStorage.setItem(VERSION_KEY, serverVersion);
        return;
      }

      if (storedVersion !== serverVersion) {
        // Version changed, show update notification
        setShowUpdate(true);
      }
    } catch (error) {
      // Silently fail - don't show errors for version checks
      console.debug("Version check failed:", error);
    }
  }, []);

  useEffect(() => {
    // Check on mount
    checkForUpdates();

    // Check periodically
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);

    // Also check when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdates();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkForUpdates]);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      // Get the new version and store it before reload
      const response = await fetch("/api/version", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(VERSION_KEY, data.version);
      }

      // Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Force reload from server
      window.location.reload();
    } catch {
      // If anything fails, just reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-surface-elevated border border-border rounded-lg shadow-2xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white">
              Nova versao disponivel
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Uma atualizacao foi lançada. Atualize para ter acesso as ultimas
              melhorias e correcoes.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="text-xs"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Atualizar agora
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-xs text-muted-foreground"
              >
                Depois
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
