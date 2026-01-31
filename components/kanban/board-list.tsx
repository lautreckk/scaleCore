"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, LayoutGrid, MessageSquare, Users, Settings } from "lucide-react";
import { CreateBoardDialog } from "./create-board-dialog";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  entity_type: string;
  is_default: boolean;
  item_count: number;
  kanban_stages: Stage[];
  created_at: string;
}

export function BoardList() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const supabase = createClient();

  const loadBoards = async () => {
    try {
      const response = await fetch("/api/kanban/boards");
      if (response.ok) {
        const data = await response.json();
        setBoards(data);
      }
    } catch (error) {
      console.error("Error loading boards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, []);

  const handleBoardCreated = (board: Board) => {
    setBoards([...boards, board]);
    setCreateDialogOpen(false);
  };

  const getEntityTypeIcon = (type: string) => {
    switch (type) {
      case "chats":
        return <MessageSquare className="h-4 w-4" />;
      case "leads":
        return <Users className="h-4 w-4" />;
      default:
        return <LayoutGrid className="h-4 w-4" />;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case "chats":
        return "Conversas";
      case "leads":
        return "Leads";
      default:
        return "Todos";
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kanban</h1>
          <p className="text-muted-foreground">
            Gerencie seus pipelines e etapas de atendimento
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Board
        </Button>
      </div>

      {boards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhum board encontrado
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro board para organizar suas conversas e leads.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Board
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link key={board.id} href={`/kanban/${board.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {board.name}
                      {board.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Padrao
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                  {board.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {board.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      {getEntityTypeIcon(board.entity_type)}
                      {getEntityTypeLabel(board.entity_type)}
                    </span>
                    <span>{board.item_count} items</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {board.kanban_stages.slice(0, 4).map((stage) => (
                      <Badge
                        key={stage.id}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: stage.color, color: stage.color }}
                      >
                        {stage.name}
                      </Badge>
                    ))}
                    {board.kanban_stages.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{board.kanban_stages.length - 4}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateBoardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleBoardCreated}
      />
    </div>
  );
}
