
-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Sem título',
  content TEXT,
  color TEXT DEFAULT '#7C3AED',
  emoji TEXT,
  tags TEXT[],
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','todo','in_progress','done','cancelled')),
  priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none','low','medium','high','urgent')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  estimated_minutes INTEGER,
  subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  recurrence_end_date DATE,
  recurrence_parent_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
  cover_color TEXT,
  emoji TEXT,
  start_date DATE,
  target_date DATE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create entity_links table
CREATE TABLE public.entity_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('note','task','project')),
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('note','task','project')),
  target_id UUID NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id, target_type, target_id)
);

-- Indexes
CREATE INDEX idx_notes_updated_at ON public.notes(updated_at);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_entity_links_source ON public.entity_links(source_id);
CREATE INDEX idx_entity_links_target ON public.entity_links(target_id);

-- Trigger function: set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger function: cascade_delete_links
CREATE OR REPLACE FUNCTION public.cascade_delete_links()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.entity_links WHERE source_id = OLD.id OR target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_notes_cascade_links AFTER DELETE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_links();
CREATE TRIGGER trg_tasks_cascade_links AFTER DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_links();
CREATE TRIGGER trg_projects_cascade_links AFTER DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_links();

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

-- Allow-all policies
CREATE POLICY "allow_all_select" ON public.notes FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON public.notes FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON public.notes FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON public.notes FOR DELETE USING (true);

CREATE POLICY "allow_all_select" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON public.tasks FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON public.tasks FOR DELETE USING (true);

CREATE POLICY "allow_all_select" ON public.projects FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON public.projects FOR DELETE USING (true);

CREATE POLICY "allow_all_select" ON public.entity_links FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON public.entity_links FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON public.entity_links FOR UPDATE USING (true);
CREATE POLICY "allow_all_delete" ON public.entity_links FOR DELETE USING (true);
