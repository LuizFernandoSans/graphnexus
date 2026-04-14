import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type { TaskStatus } from "@/types/entities";

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "#6B7280" },
  { id: "todo", label: "A Fazer", color: "#3B82F6" },
  { id: "in_progress", label: "Em Progresso", color: "#F59E0B" },
  { id: "done", label: "Concluído", color: "#10B981" },
];

interface MoveTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: TaskStatus;
  onMove: (newStatus: TaskStatus) => void;
}

export function MoveTaskDrawer({ open, onOpenChange, currentStatus, onMove }: MoveTaskDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Mover para...</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-2 p-4 pb-8">
          {COLUMNS.filter((col) => col.id !== currentStatus).map((col) => (
            <Button
              key={col.id}
              variant="outline"
              className="justify-start gap-3 min-h-[48px] text-base"
              onClick={() => {
                onMove(col.id);
                onOpenChange(false);
              }}
            >
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
              {col.label}
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
