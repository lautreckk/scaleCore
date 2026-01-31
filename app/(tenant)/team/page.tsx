"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, USER_ROLES, getInitials } from "@/lib/utils";
import { DepartmentDialog } from "@/components/team/department-dialog";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { EditMemberDialog } from "@/components/team/edit-member-dialog";
import { toast } from "sonner";
import {
  Plus,
  Search,
  UsersRound,
  Mail,
  Shield,
  Building2,
  Clock,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  department_id: string | null;
  permissions: Permissions | null;
  max_concurrent_chats: number;
  user_departments?: Array<{
    department: Department;
  }>;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_default: boolean;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
  departments: Department | null;
  invited_by_user: { name: string; email: string } | null;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("viewer");

  // Dialogs
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showEditMemberDialog, setShowEditMemberDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return;

    setTenantId(tenantUser.tenant_id);
    setCurrentUserRole(tenantUser.role || "viewer");

    // Load members with department relations
    const { data: membersData } = await supabase
      .from("tenant_users")
      .select(`
        *,
        user_departments(
          department:department_id(id, name, color)
        )
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: true });

    setMembers(membersData || []);

    // Load departments
    const { data: deptData } = await supabase
      .from("departments")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("name");

    setDepartments(deptData || []);

    // Load pending invites
    const { data: invitesData } = await supabase
      .from("tenant_invites")
      .select(`
        *,
        departments:department_id(id, name, color),
        invited_by_user:invited_by(name, email)
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setInvites(invitesData || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter members by search
  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: "bg-primary/10 text-primary border-primary/20",
      admin: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      manager: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      agent: "bg-green-500/10 text-green-500 border-green-500/20",
      viewer: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    };

    const roleLabel = USER_ROLES.find((r) => r.value === role)?.label || role;

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
          colors[role] || colors.viewer
        }`}
      >
        <Shield className="h-3 w-3" />
        {roleLabel}
      </span>
    );
  };

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member);
    setShowEditMemberDialog(true);
  };

  const handleEditDepartment = (dept: Department) => {
    setSelectedDepartment(dept);
    setShowDepartmentDialog(true);
  };

  const handleDeleteDepartment = async (deptId: string) => {
    try {
      const response = await fetch(`/api/team/departments?id=${deptId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao excluir departamento");
      }

      toast.success("Departamento excluído");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir");
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/team/invites?id=${inviteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao cancelar convite");
      }

      toast.success("Convite cancelado");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cancelar");
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const canManage = ["owner", "admin", "manager"].includes(currentUserRole);
  const canManageDepartments = ["owner", "admin"].includes(currentUserRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipe</h1>
          <p className="text-muted-foreground">Gerencie os membros e departamentos da sua equipe</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowInviteDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Convidar Membro
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <UsersRound className="h-4 w-4" />
            Membros
            <Badge variant="secondary" className="ml-1">
              {members.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building2 className="h-4 w-4" />
            Departamentos
            <Badge variant="secondary" className="ml-1">
              {departments.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-2">
            <Clock className="h-4 w-4" />
            Convites
            {invites.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {invites.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar membros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Team Members */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-24 bg-surface-elevated rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UsersRound className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {search ? "Nenhum membro encontrado" : "Nenhum membro"}
                </h3>
                <p className="text-muted-foreground text-center mb-4">
                  {search
                    ? "Tente buscar por outro termo."
                    : "Convide membros para sua equipe."}
                </p>
                {!search && canManage && (
                  <Button onClick={() => setShowInviteDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Convidar Membro
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMembers.map((member) => (
                <Card key={member.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-white truncate">{member.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {member.email}
                          </p>
                        </div>
                      </div>
                      {canManage && member.role !== "owner" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditMember(member)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      {getRoleBadge(member.role || "agent")}
                      <span
                        className={`text-xs ${
                          member.status === "active"
                            ? "text-green-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {member.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    {/* Departments */}
                    {member.user_departments && member.user_departments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {member.user_departments.map((ud) => (
                          <Badge
                            key={ud.department.id}
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: ud.department.color, color: ud.department.color }}
                          >
                            {ud.department.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {member.last_login_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Último acesso: {formatDateTime(member.last_login_at)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Roles Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Níveis de Acesso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                {USER_ROLES.map((role) => (
                  <div key={role.value} className="text-sm">
                    <span className="font-medium text-white">{role.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {role.value === "owner" && "Acesso total"}
                      {role.value === "admin" && "Gerencia tudo exceto billing"}
                      {role.value === "manager" && "Gerencia leads e campanhas"}
                      {role.value === "agent" && "Atende leads e chats"}
                      {role.value === "viewer" && "Apenas visualização"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          {canManageDepartments && (
            <div className="flex justify-end">
              <Button onClick={() => {
                setSelectedDepartment(null);
                setShowDepartmentDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Departamento
              </Button>
            </div>
          )}

          {departments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Nenhum departamento</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crie departamentos para organizar sua equipe e direcionar atendimentos.
                </p>
                {canManageDepartments && (
                  <Button onClick={() => setShowDepartmentDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Departamento
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departments.map((dept) => {
                const memberCount = members.filter(
                  (m) =>
                    m.department_id === dept.id ||
                    m.user_departments?.some((ud) => ud.department.id === dept.id)
                ).length;

                return (
                  <Card key={dept.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: dept.color + "20" }}
                          >
                            <Building2 className="h-5 w-5" style={{ color: dept.color }} />
                          </div>
                          <div>
                            <h3 className="font-medium text-white flex items-center gap-2">
                              {dept.name}
                              {dept.is_default && (
                                <Badge variant="secondary" className="text-xs">Padrão</Badge>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {memberCount} {memberCount === 1 ? "membro" : "membros"}
                            </p>
                          </div>
                        </div>
                        {canManageDepartments && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditDepartment(dept)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteDepartment(dept.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-sm text-muted-foreground mt-3">{dept.description}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites" className="space-y-4">
          {invites.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Nenhum convite pendente</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Os convites enviados aparecerão aqui.
                </p>
                {canManage && (
                  <Button onClick={() => setShowInviteDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Convidar Membro
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <Card key={invite.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <Mail className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {invite.name || invite.email}
                          </p>
                          {invite.name && (
                            <p className="text-sm text-muted-foreground">{invite.email}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {getRoleBadge(invite.role)}
                            {invite.departments && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: invite.departments.color,
                                  color: invite.departments.color,
                                }}
                              >
                                {invite.departments.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-4">
                          <p className="text-xs text-muted-foreground">
                            Enviado por {invite.invited_by_user?.name || "Sistema"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expira em {formatDateTime(invite.expires_at)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invite.token)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar Link
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvite(invite.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        onSuccess={loadData}
        departments={departments}
      />

      <DepartmentDialog
        open={showDepartmentDialog}
        onOpenChange={setShowDepartmentDialog}
        department={selectedDepartment}
        onSave={loadData}
        tenantId={tenantId || ""}
      />

      <EditMemberDialog
        open={showEditMemberDialog}
        onOpenChange={setShowEditMemberDialog}
        member={selectedMember}
        onSuccess={loadData}
        departments={departments}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
