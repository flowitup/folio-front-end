"use client";

import { useParams } from "next/navigation";
import { KanbanBoard } from "@/components/planning/kanban-board";

export default function PlanningPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="fade-up px-8 pb-12">
      <KanbanBoard projectId={projectId} />
    </div>
  );
}
