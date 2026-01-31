"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, MessageSquare, Megaphone, Zap, Settings, CreditCard, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { USER_ROLES } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  color: string;
}

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  departments: Department[];
}

interface Permissions {
  leads: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  chats: { view: boolean; send: boolean; assign: boolean; close: boolean };
  campaigns: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  automations: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  team: { view: boolean; invite: boolean; edit: boolean; remove: boolean };
  settings: { view: boolean; edit: boolean };
  billing: { view: boolean; edit: boolean };
  reports: { view: boolean; export: boolean };
}

const DEFAULT_PERMISSIONS: Permissions = {
  leads: { view: true, create: true, edit: true, delete: false },
  chats: { view: true, send: true, assign: false, close: false },
  campaigns: { view: false, create: false, edit: false, delete: false },
  automations: { view: false, create: false, edit: false, delete: false },
  team: { view: false, invite: false, edit: false, remove: false },
  settings: { view: false, edit: false },
  billing: { view: false, edit: false },
  reports: { view: false, export: false },
};

const ROLE_PERMISSIONS: Record<string, Permissions> = {
  owner: {
    leads: { view: true, create: true, edit: true, delete: true },
    chats: { view: true, send: true, assign: true, close: true },
    campaigns: { view: true, create: true, edit: true, delete: true },
    automations: { view: true, create: true, edit: true, delete: true },
    team: { view: true, invite: true, edit: true, remove: true },
    settings: { view: true, edit: true },
    billing: { view: true, edit: true },
    reports: { view: true, export: true },
  },
  admin: {
    leads: { view: true, create: true, edit: true, delete: true },
    chats: { view: true, send: true, assign: true, close: true },
    campaigns: { view: true, create: true, edit: true, delete: true },
    automations: { view: true, create: true, edit: true, delete: true },
    team: { view: true, invite: true, edit: true, remove: true },
    settings: { view: true, edit: true },
    billing: { view: false, edit: false },
    reports: { view: true, export: true },
  },
  manager: {
    leads: { view: true, create: true, edit: true, delete: false },
    chats: { view: true, send: true, assign: true, close: true },
    campaigns: { view: true, create: true, edit: true, delete: false },
    automations: { view: true, create: false, edit: false, delete: false },
    team: { view: true, invite: false, edit: false, remove: false },
    settings: { view: false, edit: false },
    billing: { view: false, edit: false },
    reports: { view: true, export: false },
  },
  agent: {
    leads: { view: true, create: true, edit: true, delete: false },
    chats: { view: true, send: true, assign: false, close: false },
    campaigns: { view: false, create: false, edit: false, delete: false },
    automations: { view: false, create: false, edit: false, delete: false },
    team: { view: false, invite: false, edit: false, remove: false },
    settings: { view: false, edit: false },
    billing: { view: false, edit: false },
    reports: { view: false, export: false },
  },
  viewer: {
    leads: { view: true, create: false, edit: false, delete: false },
    chats: { view: true, send: false, assign: false, close: false },
    campaigns: { view: true, create: false, edit: false, delete: false },
    automations: { view: true, create: false, edit: false, delete: false },
    team: { view: true, invite: false, edit: false, remove: false },
    settings: { view: false, edit: false },
    billing: { view: false, edit: false },
    reports: { view: true, export: false },
  },
};

const PERMISSION_SECTIONS = [
  {
    key: "leads" as const,
    label: "Leads",
    icon: Users,
    permissions: [
      { key: "view", label: "Visualizar leads" },
      { key: "create", label: "Criar leads" },
      { key: "edit", label: "Editar leads" },
      { key: "delete", label: "Excluir leads" },
    ],
  },
  {
    key: "chats" as const,
    label: "Conversas",
    icon: MessageSquare,
    permissions: [
      { key: "view", label: "Visualizar conversas" },
      { key: "send", label: "Enviar mensagens" },
      { key: "assign", label: "Atribuir conversas" },
      { key: "close", label: "Finalizar conversas" },
    ],
  },
  {
    key: "campaigns" as const,
    label: "Campanhas",
    icon: Megaphone,
    permissions: [
      { key: "view", label: "Visualizar campanhas" },
      { key: "create", label: "Criar campanhas" },
      { key: "edit", label: "Editar campanhas" },
      { key: "delete", label: "Excluir campanhas" },
    ],
  },
  {
    key: "automations" as const,
    label: "Automações",
    icon: Zap,
    permissions: [
      { key: "view", label: "Visualizar automações" },
      { key: "create", label: "Criar automações" },
      { key: "edit", label: "Editar automações" },
      { key: "delete", label: "Excluir automações" },
    ],
  },
  {
    key: "team" as const,
    label: "Equipe",
    icon: Users,
    permissions: [
      { key: "view", label: "Visualizar membros" },
      { key: "invite", label: "Convidar membros" },
      { key: "edit", label: "Editar membros" },
      { key: "remove", label: "Remover membros" },
    ],
  },
  {
    key: "settings" as const,
    label: "Configurações",
    icon: Settings,
    permissions: [
      { key: "view", label: "Visualizar configurações" },
      { key: "edit", label: "Editar configurações" },
    ],
  },
  {
    key: "billing" as const,
    label: "Faturamento",
    icon: CreditCard,
    permissions: [
      { key: "view", label: "Visualizar faturamento" },
      { key: "edit", label: "Gerenciar pagamentos" },
    ],
  },
  {
    key: "reports" as const,
    label: "Relatórios",
    icon: BarChart3,
    permissions: [
      { key: "view", label: "Visualizar relatórios" },
      { key: "export", label: "Exportar dados" },
    ],
  },
];

export function InviteMemberDialog({
  open,
  onOpenChange,
  onSuccess,
  departments,
}: InviteMemberDialogProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("agent");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [maxConcurrentChats, setMaxConcurrentChats] = useState(10);
  const [customPermissions, setCustomPermissions] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setRole("agent");
      setSelectedDepartments([]);
      setPermissions(ROLE_PERMISSIONS.agent);
      setMaxConcurrentChats(10);
      setCustomPermissions(false);
    }
  }, [open]);

  // Update permissions when role changes (unless custom is enabled)
  useEffect(() => {
    if (!customPermissions && ROLE_PERMISSIONS[role]) {
      setPermissions(ROLE_PERMISSIONS[role]);
    }
  }, [role, customPermissions]);

  const toggleDepartment = (deptId: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  const updatePermission = (
    section: keyof Permissions,
    key: string,
    value: boolean
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          role,
          department_ids: selectedDepartments,
          permissions: customPermissions ? permissions : null,
          max_concurrent_chats: maxConcurrentChats,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao enviar convite");
      }

      toast.success("Convite enviado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Envie um convite para adicionar um novo membro à sua equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do membro"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.filter(r => r.value !== "owner").map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "admin" && "Acesso total, exceto faturamento"}
                {role === "manager" && "Gerencia leads, campanhas e equipe"}
                {role === "agent" && "Atende leads e conversas"}
                {role === "viewer" && "Apenas visualização"}
              </p>
            </div>

            {/* Departments */}
            {departments.length > 0 && (
              <div className="space-y-2">
                <Label>Departamentos</Label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <Badge
                      key={dept.id}
                      variant={selectedDepartments.includes(dept.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      style={{
                        backgroundColor: selectedDepartments.includes(dept.id)
                          ? dept.color
                          : undefined,
                        borderColor: dept.color,
                      }}
                      onClick={() => toggleDepartment(dept.id)}
                    >
                      {dept.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione os departamentos que este membro pode atender
                </p>
              </div>
            )}

            {/* Max Concurrent Chats */}
            <div className="space-y-2">
              <Label htmlFor="maxChats">Máximo de chats simultâneos</Label>
              <Input
                id="maxChats"
                type="number"
                min={1}
                max={50}
                value={maxConcurrentChats}
                onChange={(e) => setMaxConcurrentChats(parseInt(e.target.value) || 10)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Limite de conversas que podem ser atribuídas ao mesmo tempo
              </p>
            </div>

            {/* Custom Permissions Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="font-medium">Permissões personalizadas</Label>
                <p className="text-xs text-muted-foreground">
                  Customize as permissões além do padrão da função
                </p>
              </div>
              <Switch
                checked={customPermissions}
                onCheckedChange={setCustomPermissions}
              />
            </div>

            {/* Permission Matrix */}
            {customPermissions && (
              <Accordion type="multiple" className="w-full">
                {PERMISSION_SECTIONS.map((section) => (
                  <AccordionItem key={section.key} value={section.key}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <section.icon className="h-4 w-4" />
                        {section.label}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pl-6">
                        {section.permissions.map((perm) => (
                          <div
                            key={perm.key}
                            className="flex items-center justify-between"
                          >
                            <Label className="font-normal">{perm.label}</Label>
                            <Switch
                              checked={
                                permissions[section.key][
                                  perm.key as keyof typeof permissions[typeof section.key]
                                ]
                              }
                              onCheckedChange={(checked) =>
                                updatePermission(section.key, perm.key, checked)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
