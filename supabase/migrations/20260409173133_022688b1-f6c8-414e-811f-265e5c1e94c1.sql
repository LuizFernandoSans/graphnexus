
-- Add user_id to all main tables
ALTER TABLE public.notes ADD COLUMN user_id uuid REFERENCES auth.users DEFAULT auth.uid();
ALTER TABLE public.tasks ADD COLUMN user_id uuid REFERENCES auth.users DEFAULT auth.uid();
ALTER TABLE public.projects ADD COLUMN user_id uuid REFERENCES auth.users DEFAULT auth.uid();
ALTER TABLE public.entity_links ADD COLUMN user_id uuid REFERENCES auth.users DEFAULT auth.uid();

-- Drop old permissive policies on notes
DROP POLICY IF EXISTS "allow_all_select" ON public.notes;
DROP POLICY IF EXISTS "allow_all_insert" ON public.notes;
DROP POLICY IF EXISTS "allow_all_update" ON public.notes;
DROP POLICY IF EXISTS "allow_all_delete" ON public.notes;

-- Drop old permissive policies on tasks
DROP POLICY IF EXISTS "allow_all_select" ON public.tasks;
DROP POLICY IF EXISTS "allow_all_insert" ON public.tasks;
DROP POLICY IF EXISTS "allow_all_update" ON public.tasks;
DROP POLICY IF EXISTS "allow_all_delete" ON public.tasks;

-- Drop old permissive policies on projects
DROP POLICY IF EXISTS "allow_all_select" ON public.projects;
DROP POLICY IF EXISTS "allow_all_insert" ON public.projects;
DROP POLICY IF EXISTS "allow_all_update" ON public.projects;
DROP POLICY IF EXISTS "allow_all_delete" ON public.projects;

-- Drop old permissive policies on entity_links
DROP POLICY IF EXISTS "allow_all_select" ON public.entity_links;
DROP POLICY IF EXISTS "allow_all_insert" ON public.entity_links;
DROP POLICY IF EXISTS "allow_all_update" ON public.entity_links;
DROP POLICY IF EXISTS "allow_all_delete" ON public.entity_links;

-- New RLS policies for notes
CREATE POLICY "User isolation" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- New RLS policies for tasks
CREATE POLICY "User isolation" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- New RLS policies for projects
CREATE POLICY "User isolation" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- New RLS policies for entity_links
CREATE POLICY "User isolation" ON public.entity_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
