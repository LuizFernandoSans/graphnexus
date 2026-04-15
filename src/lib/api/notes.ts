import { supabase } from "@/integrations/supabase/client";
import type { Note } from "@/types/entities";

export async function fetchNotes(opts: {
  search?: string;
  tags?: string[];
  showArchived?: boolean;
}) {
  let query = supabase
    .from("notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (!opts.showArchived) {
    query = query.eq("archived", false);
  }

  if (opts.search) {
    query = query.or(`title.ilike.%${opts.search}%,content.ilike.%${opts.search}%`);
  }

  if (opts.tags && opts.tags.length > 0) {
    query = query.contains("tags", opts.tags);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Note[];
}

export async function fetchNote(id: string) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Note;
}

export async function createNote(note: {
  title: string;
  emoji?: string;
  color?: string;
  content?: string;
  tags?: string[];
}) {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      title: note.title,
      emoji: note.emoji || null,
      color: note.color || "#7C3AED",
      content: note.content || null,
      tags: note.tags || [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, "title" | "content" | "emoji" | "color" | "tags" | "pinned" | "archived">>
) {
  const { data, error } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function getAllNoteTags(): Promise<string[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("tags")
    .not("tags", "is", null);
  if (error) throw error;
  const tagSet = new Set<string>();
  (data || []).forEach((row: { tags: string[] | null }) => {
    (row.tags || []).forEach((t: string) => tagSet.add(t));
  });
  return Array.from(tagSet).sort();
}
