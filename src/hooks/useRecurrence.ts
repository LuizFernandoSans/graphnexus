import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, addMonths, isAfter, startOfDay } from "date-fns";
import { toast } from "sonner";
import { updateTask, createTask } from "@/lib/api/tasks";
import type { Task } from "@/types/entities";

function parseRecurrenceRule(rule: string): { unit: "day" | "week" | "month"; interval: number } | null {
  // Format: "every:<interval>:<unit>" e.g. "every:1:week", "every:3:day"
  const parts = rule.split(":");
  if (parts.length !== 3 || parts[0] !== "every") return null;
  const interval = parseInt(parts[1], 10);
  const unit = parts[2] as "day" | "week" | "month";
  if (isNaN(interval) || !["day", "week", "month"].includes(unit)) return null;
  return { unit, interval };
}

function computeNextDate(baseDate: string | null, rule: string): string | null {
  const parsed = parseRecurrenceRule(rule);
  if (!parsed) return null;

  const today = startOfDay(new Date());
  const base = baseDate ? startOfDay(new Date(baseDate)) : today;
  // If the task is overdue, use today as base
  const effectiveBase = isAfter(today, base) ? today : base;

  let next: Date;
  switch (parsed.unit) {
    case "day":
      next = addDays(effectiveBase, parsed.interval);
      break;
    case "week":
      next = addWeeks(effectiveBase, parsed.interval);
      break;
    case "month":
      next = addMonths(effectiveBase, parsed.interval);
      break;
  }

  return next.toISOString().split("T")[0];
}

export function useCompleteRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Task) => {
      // Mark current task as done
      await updateTask(task.id, {
        status: "done",
        completed_at: new Date().toISOString(),
      });

      // If recurring, create next occurrence
      if (task.recurrence_rule) {
        const nextDue = computeNextDate(task.due_date, task.recurrence_rule);

        // Check if past recurrence_end_date
        if (task.recurrence_end_date && nextDue) {
          const end = new Date(task.recurrence_end_date);
          const next = new Date(nextDue);
          if (isAfter(next, end)) {
            toast.info("Recorrência encerrada");
            return;
          }
        }

        await createTask({
          title: task.title,
          description: task.description || undefined,
          status: "todo",
          priority: task.priority,
          due_date: nextDue,
          estimated_minutes: task.estimated_minutes,
          recurrence_rule: task.recurrence_rule,
          recurrence_end_date: task.recurrence_end_date,
          recurrence_parent_id: task.recurrence_parent_id || task.id,
        });

        toast.success("Tarefa concluída — próxima ocorrência criada");
      } else {
        toast.success("Tarefa concluída");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      toast.error("Erro ao completar tarefa");
    },
  });
}

export { parseRecurrenceRule };
