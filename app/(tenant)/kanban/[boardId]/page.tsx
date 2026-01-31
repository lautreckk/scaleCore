import { KanbanBoard } from "@/components/kanban";

export default function BoardPage({ params }: { params: { boardId: string } }) {
  return <KanbanBoard boardId={params.boardId} />;
}
