"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardTabs } from "@/components/tarefas/board-tabs";
import { TaskBoard } from "@/components/tarefas/task-board";
import { CreateBoardDialog } from "@/components/tarefas/create-board-dialog";

interface TaskBoardData {
  id: string;
  name: string;
  color: string;
  description: string | null;
  visibility?: string;
  department_id?: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

export default function TarefasPage() {
  const [boards, setBoards] = useState<TaskBoardData[]>([]);
  const [activeBoard, setActiveBoard] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<TaskBoardData | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id, id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      setCurrentUserId(tenantUser.id);

      // Load boards
      const boardsRes = await fetch("/api/tarefas/boards");
      if (boardsRes.ok) {
        const boardsData = await boardsRes.json();
        setBoards(boardsData);

        // Set active board to first board if not set
        if (boardsData.length > 0 && !activeBoard) {
          setActiveBoard(boardsData[0].id);
        }
      }

      // Load team members
      const { data: membersData } = await supabase
        .from("tenant_users")
        .select("id, name, email, avatar_url")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("status", "active")
        .order("name");

      setMembers(membersData || []);

      // Load departments
      const { data: deptData } = await supabase
        .from("departments")
        .select("id, name, color")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("name");

      setDepartments(deptData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [supabase, activeBoard]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm("Tem certeza que deseja excluir este board? Todas as tarefas serão excluídas.")) {
      return;
    }

    try {
      const response = await fetch(`/api/tarefas/boards/${boardId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir board");
      }

      toast.success("Board excluído");

      // Update boards list
      const newBoards = boards.filter((b) => b.id !== boardId);
      setBoards(newBoards);

      // Set new active board
      if (activeBoard === boardId) {
        setActiveBoard(newBoards.length > 0 ? newBoards[0].id : null);
      }
    } catch (error) {
      toast.error("Erro ao excluir board");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="h-6 w-6" />
            Tarefas
          </h1>
          <p className="text-muted-foreground">
            Organize suas tarefas em boards e colunas
          </p>
        </div>
      </div>

      {boards.length === 0 ? (
        // Empty state
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <CheckSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Nenhum board ainda
            </h2>
            <p className="text-muted-foreground mb-6">
              Crie seu primeiro board para começar a organizar suas tarefas em
              colunas no estilo Kanban.
            </p>
            <Button onClick={() => setCreateBoardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Board
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Board Tabs */}
          <BoardTabs
            boards={boards}
            activeBoard={activeBoard}
            onSelectBoard={setActiveBoard}
            onCreateBoard={() => {
              setEditingBoard(null);
              setCreateBoardOpen(true);
            }}
            onEditBoard={(board) => {
              setEditingBoard(board);
              setCreateBoardOpen(true);
            }}
            onDeleteBoard={handleDeleteBoard}
          />

          {/* Active Board */}
          {activeBoard && (
            <div className="flex-1 mt-4 overflow-hidden">
              <TaskBoard
                key={activeBoard}
                boardId={activeBoard}
                members={members}
                departments={departments}
                currentUserId={currentUserId}
                onBoardUpdate={loadData}
              />
            </div>
          )}
        </>
      )}

      {/* Create Board Dialog */}
      <CreateBoardDialog
        open={createBoardOpen}
        onOpenChange={setCreateBoardOpen}
        board={editingBoard}
        departments={departments}
        onSave={() => {
          loadData();
          setEditingBoard(null);
        }}
      />
    </div>
  );
}
