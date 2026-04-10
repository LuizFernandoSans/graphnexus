import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, StickyNote, CheckSquare, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { createNote } from "@/lib/api/notes";
import { createTask } from "@/lib/api/tasks";
import { createProject } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function QuickAdd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const noteMutation = useMutation({
    mutationFn: () => createNote({ title: "Sem título" }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota criada!");
      navigate(`/notes/${note.id}`);
    },
  });

  const taskMutation = useMutation({
    mutationFn: () => createTask({ title: "Nova tarefa" }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada!");
      navigate(`/tasks/${task.id}`);
    },
  });

  const projectMutation = useMutation({
    mutationFn: () => createProject({ title: "Novo projeto" }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado!");
      navigate(`/projects/${project.id}`);
    },
  });

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-2">
          <DropdownMenuItem onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending}>
            <StickyNote className="mr-2 h-4 w-4" /> Nova Nota
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => taskMutation.mutate()} disabled={taskMutation.isPending}>
            <CheckSquare className="mr-2 h-4 w-4" /> Nova Tarefa
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => projectMutation.mutate()} disabled={projectMutation.isPending}>
            <FolderKanban className="mr-2 h-4 w-4" /> Novo Projeto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
