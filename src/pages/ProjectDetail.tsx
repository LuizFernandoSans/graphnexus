import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, Archive, ArchiveRestore, FileOutput } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchProject, updateProject, deleteProject } from "@/lib/api/projects";
import { createNote } from "@/lib/api/notes";
import { createEntityLink } from "@/lib/api/links";
import { LinkPanel } from "@/components/LinkPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
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
import type { ProjectStatus } from "@/types/entities";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Completo" },
  { value: "archived", label: "Arquivado" },
];

const PROJECT_COLORS = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#DB2777", "#4F46E5", "#0EA5E9"];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [coverColor, setCoverColor] = useState("#7C3AED");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [targetDate, setTargetDate] = useState<Date | undefined>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);

  useEffect(() => {
    if (project && project.id === id && loadedId !== id) {
      setTitle(project.title);
      setEmoji(project.emoji || "");
      setDescription(project.description || "");
      setStatus(project.status);
      setCoverColor(project.cover_color || "#7C3AED");
      setStartDate(project.start_date ? new Date(project.start_date + "T00:00:00") : undefined);
      setTargetDate(project.target_date ? new Date(project.target_date + "T00:00:00") : undefined);
      setLoadedId(id!);
      setHasUnsavedChanges(false);
    }
  }, [project, loadedId, id]);

  const markChanged = useCallback(() => setHasUnsavedChanges(true), []);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProject(id!, {
        title,
        emoji: emoji || null,
        description: description || null,
        status,
        cover_color: coverColor,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        target_date: targetDate ? format(targetDate, "yyyy-MM-dd") : null,
      }),
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto salvo!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const handleSave = useCallback(() => saveMutation.mutate(), [saveMutation]);

  const archiveMutation = useMutation({
    mutationFn: () => updateProject(id!, { archived: !project?.archived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(project?.archived ? "Projeto desarquivado" : "Projeto arquivado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto excluído");
      navigate("/projects");
    },
  });

  // Mutação tripla: extrair descrição como nota
  const extractMutation = useMutation({
    mutationFn: async () => {
      if (!description || !id || !project) throw new Error("Sem conteúdo para extrair");

      // 1. Criar a nota
      const note = await createNote({
        title: `Ref: ${project?.title || 'Sem título'}`,
        content: description,
      });

      // 2. Criar o link bidirecional
      await createEntityLink({
        source_type: "note",
        source_id: note.id,
        target_type: "project",
        target_id: id,
        label: "Extraído da descrição",
      });

      // 3. Limpar a descrição do projeto
      await updateProject(id, { description: "" });

      return note;
    },
    onSuccess: () => {
      setExtractOpen(false);
      setDescription("");
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast.success("Nota extraída e vinculada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao extrair: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    },
  });

  const blocker = useBlocker(hasUnsavedChanges);

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

  if (isLoading || !project) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="flex gap-6 max-w-5xl">
      {/* Main content */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Color header bar */}
        <div className="h-3 rounded-full" style={{ backgroundColor: coverColor }} />

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
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
            <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate()}>
              {project.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
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

        {/* Title + Emoji */}
        <div className="flex items-center gap-3">
          <Input
            value={emoji}
            onChange={(e) => { setEmoji(e.target.value); markChanged(); }}
            placeholder="🎯"
            className="w-14 text-center text-2xl bg-transparent border-border"
            maxLength={2}
          />
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); markChanged(); }}
            className="flex-1 text-xl font-heading font-bold bg-transparent border-none focus-visible:ring-0"
            placeholder="Nome do projeto"
          />
        </div>

        {/* Status + Color */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v as ProjectStatus); markChanged(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCoverColor(c); markChanged(); }}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    coverColor === c ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Data de início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); markChanged(); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Data alvo</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !targetDate && "text-muted-foreground")}>
                  {targetDate ? format(targetDate, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={targetDate} onSelect={(d) => { setTargetDate(d); markChanged(); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            {description && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExtractOpen(true)}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <FileOutput className="mr-1 h-3.5 w-3.5" />
                Transformar em Nota
              </Button>
            )}
          </div>
          <RichTextEditor
            content={description}
            onChange={(html) => { setDescription(html); markChanged(); }}
          />
        </div>
      </div>

      {/* Right sidebar - Links */}
      <div className="w-72 shrink-0">
        <LinkPanel entityId={id!} entityType="project" />
      </div>

      {/* Extract Dialog */}
      <AlertDialog open={extractOpen} onOpenChange={setExtractOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transformar Descrição em Nota?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo atual será removido desta descrição e movido para uma nova Nota independente. Ela será automaticamente vinculada a este item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setExtractOpen(false)}>Cancelar</Button>
            <Button
              variant="default"
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
            >
              {extractMutation.isPending ? "Transformando..." : "Transformar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Excluir</Button>
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
            <Button variant="ghost" onClick={() => blocker.reset?.()}>voltar</Button>
            <Button variant="secondary" onClick={() => { setHasUnsavedChanges(false); blocker.proceed?.(); }}>Não Salvar</Button>
            <Button onClick={async () => { await saveMutation.mutateAsync(); blocker.proceed?.(); }} disabled={saveMutation.isPending}>
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
