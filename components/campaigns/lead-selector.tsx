"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  Filter,
  Upload,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  FileSpreadsheet,
} from "lucide-react";

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  status: string;
  source: string | null;
  tags: string[] | null;
  score: number | null;
  assigned_to: string | null;
  created_at: string;
}

interface KanbanBoard {
  id: string;
  name: string;
}

interface KanbanStage {
  id: string;
  name: string;
  board_id: string;
}

interface FilterCriteria {
  tags?: string[];
  status?: string[];
  sources?: string[];
  kanban_board_id?: string;
  kanban_stage_id?: string;
  assigned_to?: string;
  score_min?: number;
  score_max?: number;
  created_after?: string;
  created_before?: string;
}

interface LeadSelectorProps {
  selectedLeads: string[];
  onSelectionChange: (leads: string[]) => void;
  filterCriteria: FilterCriteria;
  onFilterChange: (criteria: FilterCriteria) => void;
  onImportCSV?: (file: File) => void;
}

export function LeadSelector({
  selectedLeads,
  onSelectionChange,
  filterCriteria,
  onFilterChange,
  onImportCSV,
}: LeadSelectorProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [showCSVImport, setShowCSVImport] = useState(false);

  // Available options for filters
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [kanbanBoards, setKanbanBoards] = useState<KanbanBoard[]>([]);
  const [kanbanStages, setKanbanStages] = useState<KanbanStage[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  const supabase = createClient();

  // Load leads and filter options
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // Get tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      // Load leads
      const { data: leadsData } = await supabase
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("created_at", { ascending: false });

      if (leadsData) {
        setLeads(leadsData);

        // Extract unique tags and sources
        const tags = new Set<string>();
        const sources = new Set<string>();
        leadsData.forEach((lead) => {
          if (lead.tags) lead.tags.forEach((t: string) => tags.add(t));
          if (lead.source) sources.add(lead.source);
        });
        setAvailableTags(Array.from(tags));
        setAvailableSources(Array.from(sources));
      }

      // Load kanban boards
      const { data: boardsData } = await supabase
        .from("kanban_boards")
        .select("id, name")
        .eq("tenant_id", tenantUser.tenant_id);

      if (boardsData) {
        setKanbanBoards(boardsData);
      }

      // Load team members
      const { data: membersData } = await supabase
        .from("tenant_users")
        .select("user_id, profiles(name)")
        .eq("tenant_id", tenantUser.tenant_id);

      if (membersData) {
        setTeamMembers(
          membersData.map((m) => ({
            id: m.user_id,
            name: (m.profiles as { name?: string })?.name || "Unknown",
          }))
        );
      }

      setLoading(false);
    }

    loadData();
  }, [supabase]);

  // Load kanban stages when board changes
  useEffect(() => {
    async function loadStages() {
      if (!filterCriteria.kanban_board_id) {
        setKanbanStages([]);
        return;
      }

      const { data } = await supabase
        .from("kanban_stages")
        .select("id, name, board_id")
        .eq("board_id", filterCriteria.kanban_board_id)
        .order("position");

      if (data) {
        setKanbanStages(data);
      }
    }

    loadStages();
  }, [filterCriteria.kanban_board_id, supabase]);

  // Apply filters
  const applyFilters = useCallback(() => {
    let result = [...leads];

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(query) ||
          lead.phone.includes(query) ||
          lead.email?.toLowerCase().includes(query) ||
          lead.company?.toLowerCase().includes(query)
      );
    }

    // Tags filter
    if (filterCriteria.tags && filterCriteria.tags.length > 0) {
      result = result.filter((lead) =>
        filterCriteria.tags?.some((tag) => lead.tags?.includes(tag))
      );
    }

    // Status filter
    if (filterCriteria.status && filterCriteria.status.length > 0) {
      result = result.filter((lead) =>
        filterCriteria.status?.includes(lead.status)
      );
    }

    // Source filter
    if (filterCriteria.sources && filterCriteria.sources.length > 0) {
      result = result.filter((lead) =>
        lead.source ? filterCriteria.sources?.includes(lead.source) : false
      );
    }

    // Assigned to filter
    if (filterCriteria.assigned_to) {
      result = result.filter(
        (lead) => lead.assigned_to === filterCriteria.assigned_to
      );
    }

    // Score filter
    if (filterCriteria.score_min !== undefined) {
      result = result.filter(
        (lead) => (lead.score || 0) >= filterCriteria.score_min!
      );
    }
    if (filterCriteria.score_max !== undefined) {
      result = result.filter(
        (lead) => (lead.score || 0) <= filterCriteria.score_max!
      );
    }

    // Date filters
    if (filterCriteria.created_after) {
      result = result.filter(
        (lead) => new Date(lead.created_at) >= new Date(filterCriteria.created_after!)
      );
    }
    if (filterCriteria.created_before) {
      result = result.filter(
        (lead) => new Date(lead.created_at) <= new Date(filterCriteria.created_before!)
      );
    }

    setFilteredLeads(result);
  }, [leads, searchQuery, filterCriteria]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const toggleLeadSelection = (leadId: string) => {
    if (selectedLeads.includes(leadId)) {
      onSelectionChange(selectedLeads.filter((id) => id !== leadId));
    } else {
      onSelectionChange([...selectedLeads, leadId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredLeads.map((l) => l.id));
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const toggleTag = (tag: string) => {
    const current = filterCriteria.tags || [];
    if (current.includes(tag)) {
      onFilterChange({ ...filterCriteria, tags: current.filter((t) => t !== tag) });
    } else {
      onFilterChange({ ...filterCriteria, tags: [...current, tag] });
    }
  };

  const toggleStatus = (status: string) => {
    const current = filterCriteria.status || [];
    if (current.includes(status)) {
      onFilterChange({ ...filterCriteria, status: current.filter((s) => s !== status) });
    } else {
      onFilterChange({ ...filterCriteria, status: [...current, status] });
    }
  };

  const clearFilters = () => {
    onFilterChange({});
    setSearchQuery("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportCSV) {
      onImportCSV(file);
    }
  };

  const statuses = ["new", "contacted", "qualified", "negotiation", "won", "lost"];

  return (
    <div className="space-y-4">
      {/* Header with counts */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {filteredLeads.length} leads disponíveis
            </span>
          </div>
          <Badge variant="default">
            {selectedLeads.length} selecionados
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCSVImport(!showCSVImport)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
          {selectedLeads.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* CSV Import */}
      {showCSVImport && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Importar contatos de arquivo CSV
            </CardTitle>
            <CardDescription>
              O arquivo deve conter uma coluna com números de telefone
            </CardDescription>
          </CardHeader>
          <CardContent className="py-3">
            <Input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
            />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros avançados
            </span>
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Tags */}
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={filterCriteria.tags?.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                    {availableTags.length === 0 && (
                      <span className="text-sm text-muted-foreground">
                        Nenhuma tag encontrada
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-1">
                    {statuses.map((status) => (
                      <Badge
                        key={status}
                        variant={filterCriteria.status?.includes(status) ? "default" : "outline"}
                        className="cursor-pointer capitalize"
                        onClick={() => toggleStatus(status)}
                      >
                        {status}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Source */}
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select
                    value={filterCriteria.sources?.[0] || ""}
                    onValueChange={(value) =>
                      onFilterChange({
                        ...filterCriteria,
                        sources: value ? [value] : undefined,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as origens" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {availableSources.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Kanban Board */}
                <div className="space-y-2">
                  <Label>Kanban</Label>
                  <Select
                    value={filterCriteria.kanban_board_id || ""}
                    onValueChange={(value) =>
                      onFilterChange({
                        ...filterCriteria,
                        kanban_board_id: value || undefined,
                        kanban_stage_id: undefined,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um quadro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {kanbanBoards.map((board) => (
                        <SelectItem key={board.id} value={board.id}>
                          {board.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Kanban Stage */}
                {filterCriteria.kanban_board_id && (
                  <div className="space-y-2">
                    <Label>Etapa</Label>
                    <Select
                      value={filterCriteria.kanban_stage_id || ""}
                      onValueChange={(value) =>
                        onFilterChange({
                          ...filterCriteria,
                          kanban_stage_id: value || undefined,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as etapas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas</SelectItem>
                        {kanbanStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Assigned to */}
                <div className="space-y-2">
                  <Label>Atribuído a</Label>
                  <Select
                    value={filterCriteria.assigned_to || ""}
                    onValueChange={(value) =>
                      onFilterChange({
                        ...filterCriteria,
                        assigned_to: value || undefined,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer pessoa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Qualquer</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Score Range */}
                <div className="space-y-2">
                  <Label>Score</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filterCriteria.score_min || ""}
                      onChange={(e) =>
                        onFilterChange({
                          ...filterCriteria,
                          score_min: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filterCriteria.score_max || ""}
                      onChange={(e) =>
                        onFilterChange({
                          ...filterCriteria,
                          score_max: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Criado entre</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={filterCriteria.created_after || ""}
                      onChange={(e) =>
                        onFilterChange({
                          ...filterCriteria,
                          created_after: e.target.value || undefined,
                        })
                      }
                    />
                    <Input
                      type="date"
                      value={filterCriteria.created_before || ""}
                      onChange={(e) =>
                        onFilterChange({
                          ...filterCriteria,
                          created_before: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex justify-between pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
                <Button variant="secondary" size="sm" onClick={selectAll}>
                  Selecionar todos ({filteredLeads.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Leads List */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Leads</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando leads...
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum lead encontrado
              </div>
            ) : (
              <div className="divide-y">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleLeadSelection(lead.id)}
                  >
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleLeadSelection(lead.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {lead.name || "Sem nome"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lead.phone}
                        {lead.email && ` • ${lead.email}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="capitalize text-xs">
                        {lead.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
