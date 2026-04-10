import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, Check, Archive } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchTask, updateTask, deleteTask } from "@/lib/api/tasks";
import { useCompleteRecurringTask } from "@/hooks/useRecurrence";
import { RecurrenceSelector } from "@/components/RecurrenceSelector";
import { LinkPanel } from "@/components/LinkPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@/types/entities";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "A Fazer" },
  { value: "in_progress", label: "Em Progresso" },
  { value: "done", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "none", label: "Nenhuma" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeRecurring = useCompleteRecurringTask();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (task && !loaded) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? new Date(task.due_date + "T00:00:00") : undefined);
      setRecurrenceRule(task.recurrence_rule);
      setEstimatedMinutes(task.estimated_minutes?.toString() || "");
      setLoaded(true);
    }
  }, [task, loaded]);

  const markChanged = useCallback(() => setHasUnsavedChanges(true), []);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTask(id!, {
        title,
        description: description || null,
        status,
        priority,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        recurrence_rule: recurrenceRule,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
      }),
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa salva!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const handleSave = useCallback(() => saveMutation.mutate(), [saveMutation]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída");
      navigate("/tasks");
    },
  });

  const blocker = useBlocker(hasUnsavedChanges);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasUnsavedChanges, handleSave]);

  if (isLoading || !task) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <>
      <div className="flex gap-6 max-w-5xl">
        <div className="flex-1 flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-xs text-primary animate-pulse">Alterações não salvas</span>
          )}
          <Button onClick={handleSave} disabled={!hasUnsavedChanges || saveMutation.isPending} size="sm">
            <Save className="mr-1 h-4 w-4" />
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
          {task.status !== "done" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => completeRecurring.mutate(task)}
            >
              <Check className="mr-1 h-4 w-4" /> Concluir
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Arquivar"
            onClick={async () => {
              setHasUnsavedChanges(false);
              await updateTask(id!, { archived: true });
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
              toast.success("Tarefa arquivada");
              navigate("/tasks");
            }}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <Input
        value={title}
        onChange={(e) => { setTitle(e.target.value); markChanged(); }}
        className="text-xl font-heading font-bold bg-transparent border-none focus-visible:ring-0"
        placeholder="Título da tarefa"
      />

      {/* Status + Priority row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v as TaskStatus); markChanged(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Prioridade</Label>
          <Select value={priority} onValueChange={(v) => { setPriority(v as TaskPriority); markChanged(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Due date */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Data de entrega</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
            >
              {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecionar data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(d) => { setDueDate(d); markChanged(); }}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Estimated minutes */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Tempo estimado (min)</Label>
        <Input
          type="number"
          value={estimatedMinutes}
          onChange={(e) => { setEstimatedMinutes(e.target.value); markChanged(); }}
          placeholder="Ex: 30"
          className="w-32"
        />
      </div>

      {/* Recurrence */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Recorrência</Label>
        <RecurrenceSelector
          value={recurrenceRule}
          onChange={(v) => { setRecurrenceRule(v); markChanged(); }}
        />
      </div>

      {/* Description */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Descrição</Label>
        <Textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); markChanged(); }}
          placeholder="Detalhes da tarefa..."
          rows={6}
        />
      </div>
      </div>

      {/* Right sidebar - Links */}
      <div className="w-72 shrink-0">
        <LinkPanel entityId={id!} entityType="task" />
      </div>
    </div>

    {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Blocker */}
      <AlertDialog open={blocker.state === "blocked"} onOpenChange={() => blocker.reset?.()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>tá loco? vai sair sem salvar?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => blocker.reset?.()}>
              voltar
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setHasUnsavedChanges(false); blocker.proceed?.(); }}
            >
              Não Salvar
            </Button>
            <Button
              onClick={async () => { await saveMutation.mutateAsync(); blocker.proceed?.(); }}
              disabled={saveMutation.isPending}
            >
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
    </>
  );
}
