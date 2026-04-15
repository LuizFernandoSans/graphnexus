-- Criar Storage Bucket público para arquivos do Nexus
-- Execute este SQL no Supabase Dashboard (Storage > Policies ou SQL Editor)

-- 1. Criar o bucket público nexus_files (apenas se não existir)
-- Nota: Buckets são criados via API/Dashboard, mas as políticas são criadas via SQL

-- 2. Habilitar RLS no storage.objects (se ainda não estiver habilitado)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para SELECT (leitura) - apenas arquivos do próprio usuário
CREATE POLICY "nexus_files_select_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Criar política para INSERT (upload) - apenas arquivos do próprio usuário
CREATE POLICY "nexus_files_insert_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Criar política para UPDATE - apenas arquivos do próprio usuário
CREATE POLICY "nexus_files_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Criar política para DELETE - apenas arquivos do próprio usuário
CREATE POLICY "nexus_files_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- NOTA: O bucket "nexus_files" precisa ser criado manualmente no Supabase Dashboard:
-- 1. Vá em Storage no menu lateral
-- 2. Clique em "New bucket"
-- 3. Nome: nexus_files
-- 4. Marque "Public bucket"
-- 5. Clique em "Create bucket"
