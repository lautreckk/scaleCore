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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Users, MessageSquare, Megaphone, Zap, Settings, CreditCard, BarChart3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { USER_ROLES } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  color: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: Permissions | null;
  max_concurrent_chats: number;
  department_id: string | null;
  user_departments?: Array<{
    department: Department;
  }>;
}

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  onSuccess: () => void;
  departments: Department[];
  currentUserRole: string;
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

export function EditMemberDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
  departments,
  currentUserRole,
}: EditMemberDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("agent");
  const [status, setStatus] = useState("active");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [maxConcurrentChats, setMaxConcurrentChats] = useState(10);
  const [customPermissions, setCustomPermissions] = useState(false);

  // Load member data when dialog opens
  useEffect(() => {
    if (member && open) {
      setName(member.name || "");
      setRole(member.role || "agent");
      setStatus(member.status || "active");
      setMaxConcurrentChats(member.max_concurrent_chats || 10);

      // Set departments
      const deptIds = member.user_departments?.map(ud => ud.department.id) ||
                      (member.department_id ? [member.department_id] : []);
      setSelectedDepartments(deptIds);

      // Set permissions
      if (member.permissions) {
        setPermissions(member.permissions);
        setCustomPermissions(true);
      } else {
        setPermissions(ROLE_PERMISSIONS[member.role] || DEFAULT_PERMISSIONS);
        setCustomPermissions(false);
      }
    }
  }, [member, open]);

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
    if (!member) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/team/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          status,
          department_ids: selectedDepartments,
          permissions: customPermissions ? permissions : null,
          max_concurrent_chats: maxConcurrentChats,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar membro");
      }

      toast.success("Membro atualizado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!member) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/team/members/${member.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao remover membro");
      }

      toast.success("Membro removido com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isOwner = member?.role === "owner";
  const canEdit = !isOwner || currentUserRole === "owner";
  const canDelete = !isOwner && ["owner", "admin"].includes(currentUserRole);

  if (!member) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Editar Membro</DialogTitle>
              <DialogDescription>
                {member.name} ({member.email})
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              {/* Role Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select value={role} onValueChange={setRole} disabled={!canEdit || isOwner}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.filter(r =>
                        r.value !== "owner" || currentUserRole === "owner"
                      ).map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus} disabled={!canEdit || isOwner}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                        onClick={() => canEdit && toggleDepartment(dept.id)}
                      >
                        {dept.name}
                      </Badge>
                    ))}
                  </div>
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
                  disabled={!canEdit}
                />
              </div>

              {/* Custom Permissions Toggle */}
              {canEdit && !isOwner && (
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
              )}

              {/* Permission Matrix */}
              {customPermissions && canEdit && (
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

            <DialogFooter className="gap-2">
              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              {canEdit && (
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {member.name} da equipe? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
