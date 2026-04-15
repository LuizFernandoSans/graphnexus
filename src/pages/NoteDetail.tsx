import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Pin, PinOff, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useNoteDetail } from "@/hooks/useNoteDetail";
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

  const {
    note,
    isLoading,
    title,
    emoji,
    content,
    hasUnsavedChanges,
    setTitle,
    setEmoji,
    setContent,
    handleSave,
    handlePin,
    handleArchive,
    handleDelete,
    blocker,
    saveMutation,
    pinMutation,
    archiveMutation,
    deleteMutation,
  } = useNoteDetail(id);

  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const proceedWithBlocker = () => blocker.proceed?.();

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
              <Button variant="ghost" size="icon" onClick={handlePin} disabled={pinMutation.isPending} title={note.pinned ? "Desafixar" : "Fixar"}>
                {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleArchive} disabled={archiveMutation.isPending} title={note.archived ? "Desarquivar" : "Arquivar"}>
                {note.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title + Emoji */}
          <div className="flex items-center gap-3">
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="😀" className="w-14 text-center text-2xl bg-transparent border-border" maxLength={2} />
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 text-xl font-heading font-bold bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0" placeholder="Título da nota" />
          </div>

          {/* Editor */}
          <RichTextEditor content={content} onChange={setContent} />
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
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Excluir</Button>
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
            <Button variant="secondary" onClick={proceedWithBlocker}>Não Salvar</Button>
            <Button onClick={async () => { await saveMutation.mutateAsync(); blocker.proceed?.(); }} disabled={saveMutation.isPending}>
              <Save className="mr-1 h-4 w-4" /> Salvar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
