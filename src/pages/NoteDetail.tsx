import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Pin, PinOff, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchNote, updateNote, deleteNote } from "@/lib/api/notes";
import { LinkPanel } from "@/components/LinkPanel";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: note, isLoading } = useQuery({
    queryKey: ["note", id],
    queryFn: () => fetchNote(id!),
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [content, setContent] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Populate form when note loads
  useEffect(() => {
    if (note && note.id === id && loadedId !== id) {
      setTitle(note.title);
      setEmoji(note.emoji || "");
      setContent(note.content || "");
      setLoadedId(id!);
      setHasUnsavedChanges(false);
    }
  }, [note, loadedId, id]);

  // Track unsaved changes
  const handleTitleChange = useCallback((val: string) => {
    setTitle(val);
    setHasUnsavedChanges(true);
  }, []);

  const handleEmojiChange = useCallback((val: string) => {
    setEmoji(val);
    setHasUnsavedChanges(true);
  }, []);

  const handleContentChange = useCallback((html: string) => {
    setContent(html);
    setHasUnsavedChanges(true);
  }, []);

  // Auto-title helper
  const deriveTitle = (currentTitle: string, htmlContent: string): string => {
    if (currentTitle && currentTitle !== "Sem título") return currentTitle;
    const doc = new DOMParser().parseFromString(htmlContent, "text/html");
    const plain = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    if (!plain) return "Sem título";
    const words = plain.split(" ").slice(0, 5).join(" ");
    const derived = words.length > 30 ? words.slice(0, 30) : words;
    return derived + (plain.length > derived.length ? "..." : "");
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const finalTitle = deriveTitle(title, content);
      return updateNote(id!, { title: finalTitle, emoji: emoji || null, content });
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota salva!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  // Pin / Archive mutations
  const pinMutation = useMutation({
    mutationFn: () => updateNote(id!, { pinned: !note?.pinned }),
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success(updatedNote.pinned ? "Nota fixada" : "Nota desafixada");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const archiveMutation = useMutation({
    mutationFn: () => updateNote(id!, { archived: !note?.archived }),
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success(updatedNote.archived ? "Nota arquivada" : "Nota desarquivada");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNote(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota excluída");
      navigate("/notes");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  // Block navigation when unsaved
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

  if (isLoading || !note) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  return (
    <>
      <div className="flex gap-6 max-w-5xl">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/notes")}>
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
              <Button variant="ghost" size="icon" onClick={() => pinMutation.mutate()} title={note.pinned ? "Desafixar" : "Fixar"}>
                {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate()} title={note.archived ? "Desarquivar" : "Arquivar"}>
                {note.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title + Emoji */}
          <div className="flex items-center gap-3">
            <Input value={emoji} onChange={(e) => handleEmojiChange(e.target.value)} placeholder="😀" className="w-14 text-center text-2xl bg-transparent border-border" maxLength={2} />
            <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} className="flex-1 text-xl font-heading font-bold bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Título da nota" />
          </div>

          {/* Editor */}
          <RichTextEditor content={content} onChange={handleContentChange} />
        </div>

        {/* Right sidebar - Links */}
        <div className="w-72 shrink-0">
          <LinkPanel entityId={id!} entityType="note" />
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta nota? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Excluir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Blocker Dialog */}
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
    </>
  );
}
