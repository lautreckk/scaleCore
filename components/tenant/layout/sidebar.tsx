"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Megaphone,
  Zap,
  Wallet,
  Settings,
  UsersRound,
  Link2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  plan?: string;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Conversas", href: "/chats", icon: MessageSquare },
  { name: "Campanhas", href: "/campaigns", icon: Megaphone },
  { name: "Automações", href: "/automations", icon: Zap },
  { name: "Créditos", href: "/credits", icon: Wallet },
  { name: "Equipe", href: "/team", icon: UsersRound },
  { name: "Integrações", href: "/settings/integrations", icon: Link2 },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar({ open, onClose, plan = "Starter" }: SidebarProps) {
  const pathname = usePathname();

  const isActiveRoute = (href: string) => {
    // Exact match
    if (pathname === href) return true;

    // For /settings, only match if not in a sub-route that has its own menu item
    if (href === "/settings") {
      return pathname.startsWith("/settings/") &&
             !pathname.startsWith("/settings/integrations");
    }

    // For other routes, match if starts with href + "/"
    return pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-surface transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-border">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="text-lg font-bold text-white">ScaleForce</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = isActiveRoute(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:bg-surface-elevated hover:text-white"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 rounded-lg bg-surface-elevated p-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Seu plano</p>
                <p className="text-sm font-medium text-white truncate capitalize">{plan}</p>
              </div>
              <Link href="/settings/billing">
                <Button size="sm" variant="outline" className="text-xs">
                  Upgrade
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
