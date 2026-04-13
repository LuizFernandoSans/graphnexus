import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, StickyNote, CheckSquare, FolderKanban, Send } from "lucide-react";
import { toast } from "sonner";
import { createNote } from "@/lib/api/notes";
import { createTask } from "@/lib/api/tasks";
import { createProject } from "@/lib/api/projects";
import { parseTaskInput } from "@/lib/parseTaskInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function QuickAdd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickText, setQuickText] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);

  const noteMutation = useMutation({
    mutationFn: () => createNote({ title: "Sem título" }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota criada!");
      navigate(`/notes/${note.id}`);
    },
  });

  const taskMutation = useMutation({
    mutationFn: (params: { title: string; due_date?: string | null; status?: string }) =>
      createTask(params),
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

  const handleQuickTask = () => {
    if (!quickText.trim()) return;
    const parsed = parseTaskInput(quickText);
    taskMutation.mutate({
      title: parsed.title,
      due_date: parsed.due_date,
      status: parsed.status,
    });
    setQuickText("");
    setQuickOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
      {/* Quick task input */}
      <Popover open={quickOpen} onOpenChange={setQuickOpen}>
        <PopoverTrigger asChild>
          <span className="sr-only">Quick task</span>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-80 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuickTask();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder='Ex: "comprar pão amanhã"'
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              className="flex-1 text-sm"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!quickText.trim() || taskMutation.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground mt-2">
            Datas são detectadas automaticamente ✨
          </p>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg transition-all duration-200 active:scale-[0.97]">
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-2">
          <DropdownMenuItem onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending}>
            <StickyNote className="mr-2 h-4 w-4" /> Nova Nota
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuickOpen(true)}>
            <CheckSquare className="mr-2 h-4 w-4" /> Nova Tarefa Rápida
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => taskMutation.mutate({ title: "Nova tarefa" })} disabled={taskMutation.isPending}>
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
