import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Plus, Trash2, StickyNote, CheckSquare, FolderKanban } from "lucide-react";
import { useEntityLinks, useCreateLink, useDeleteLink } from "@/hooks/useLinks";
import { LinkPicker } from "@/components/LinkPicker";
import { Button } from "@/components/ui/button";
import type { EntityType, EntityLink } from "@/types/entities";

const TYPE_ICONS: Record<EntityType, React.ElementType> = {
  note: StickyNote,
  task: CheckSquare,
  project: FolderKanban,
};

const TYPE_LABELS: Record<EntityType, string> = {
  note: "Nota",
  task: "Tarefa",
  project: "Projeto",
};

const TYPE_ROUTES: Record<EntityType, string> = {
  note: "/notes",
  task: "/tasks",
  project: "/projects",
};

interface LinkPanelProps {
  entityId: string;
  entityType: EntityType;
}

function getLinkedEntity(link: EntityLink, selfId: string): { type: EntityType; id: string } {
  if (link.source_id === selfId) {
    return { type: link.target_type, id: link.target_id };
  }
  return { type: link.source_type, id: link.source_id };
}

export function LinkPanel({ entityId, entityType }: LinkPanelProps) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: links = [], isLoading } = useEntityLinks(entityId, entityType);
  const createLink = useCreateLink(entityId, entityType);
  const deleteLink = useDeleteLink(entityId, entityType);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="h-4 w-4" />
          Links ({links.length})
        </div>
        <Button variant="ghost" size="icon" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}

      <div className="flex flex-col gap-1">
        {links.map((link) => {
          const linked = getLinkedEntity(link, entityId);
          const Icon = TYPE_ICONS[linked.type];
          return (
            <div
              key={link.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={() => navigate(`${TYPE_ROUTES[linked.type]}/${linked.id}`)}
                className="flex-1 text-left text-sm truncate text-foreground hover:underline"
              >
                {linked.id.slice(0, 8)}…
              </button>
              <span className="text-xs text-muted-foreground">{TYPE_LABELS[linked.type]}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => deleteLink.mutate(link.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
        {links.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum link</p>
        )}
      </div>

      <LinkPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeId={entityId}
        onSelect={(target) => createLink.mutate(target)}
      />
    </div>
  );
}
