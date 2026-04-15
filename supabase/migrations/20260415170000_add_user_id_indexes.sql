-- DB-01: Add missing indexes on user_id columns.
-- RLS policies filter by auth.uid() = user_id on every query,
-- so without indexes this causes sequential scans on all tables.

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_user_id ON public.entity_links(user_id);
