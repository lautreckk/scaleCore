"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  Building2,
  Plug,
  Webhook,
  Bell,
  CreditCard,
  Zap,
} from "lucide-react";

const settingsNav = [
  { label: "Perfil", href: "/settings", icon: User },
  { label: "Empresa", href: "/settings/company", icon: Building2 },
  { label: "Integrações", href: "/settings/integrations", icon: Plug },
  { label: "Fontes de Leads", href: "/settings/sources", icon: Webhook },
  { label: "Mensagens Rápidas", href: "/settings/quick-replies", icon: Zap },
  { label: "Notificações", href: "/settings/notifications", icon: Bell },
  { label: "Faturamento", href: "/settings/billing", icon: CreditCard },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua conta
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="lg:w-64 flex-shrink-0">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
            {settingsNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/settings" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
