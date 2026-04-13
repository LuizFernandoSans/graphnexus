import * as chrono from "chrono-node";
import { isToday, isBefore, startOfDay } from "date-fns";

interface ParsedTaskInput {
  title: string;
  due_date: string | null;
  status: string;
}

export function parseTaskInput(rawText: string): ParsedTaskInput {
  const results = chrono.pt.parse(rawText);

  let title = rawText.trim();
  let due_date: string | null = null;
  let status = "backlog";

  if (results.length > 0) {
    const match = results[0];
    const date = match.start.date();
    due_date = date.toISOString().split("T")[0];

    // Remove the matched date text from the title
    const matchedText = match.text;
    title = title.replace(matchedText, "").replace(/\s{2,}/g, " ").trim();
    if (!title) title = rawText.trim();

    // Status logic
    const today = startOfDay(new Date());
    const dueDay = startOfDay(date);
    if (isBefore(dueDay, today) || isToday(date)) {
      status = "todo";
    } else {
      status = "backlog";
    }
  }

  return { title, due_date, status };
}
