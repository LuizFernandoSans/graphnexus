import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

async function fetchUpcomingDueTasks() {
  const today = format(new Date(), "yyyy-MM-dd");
  const threeDays = format(addDays(new Date(), 3), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_date")
    .eq("archived", false)
    .neq("status", "done")
    .neq("status", "cancelled")
    .gte("due_date", today)
    .lte("due_date", threeDays)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

export function useTaskDueNotifications() {
  const notified = useRef(false);

  const { data: tasks } = useQuery({
    queryKey: ["due-notifications"],
    queryFn: fetchUpcomingDueTasks,
    refetchInterval: 5 * 60 * 1000, // every 5 min
  });

  useEffect(() => {
    if (!tasks || tasks.length === 0 || notified.current) return;
    notified.current = true;

    if (tasks.length === 1) {
      toast.warning(`⏰ "${tasks[0].title}" vence em breve!`);
    } else {
      toast.warning(`⏰ ${tasks.length} tarefas vencem nos próximos 3 dias!`);
    }
  }, [tasks]);
}
