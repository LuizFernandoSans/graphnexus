-- Criar Storage Bucket PRIVADO para arquivos do Nexus
-- Execute este SQL no Supabase Dashboard (Storage > Policies ou SQL Editor)

-- IMPORTANTE: O bucket deve ser criado como PRIVADO (não público) no Dashboard!
-- Bucket público = URLs acessíveis sem autenticação (bypass RLS)

-- 1. Habilitar RLS no storage.objects (se ainda não estiver habilitado)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas se existirem (para recriação segura)
DROP POLICY IF EXISTS "nexus_files_select_own" ON storage.objects;
DROP POLICY IF EXISTS "nexus_files_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "nexus_files_update_own" ON storage.objects;
DROP POLICY IF EXISTS "nexus_files_delete_own" ON storage.objects;

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

-- INSTRUÇÕES PARA CRIAR O BUCKET CORRETAMENTE:
-- 1. Vá em Storage no menu lateral do Supabase Dashboard
-- 2. Clique em "New bucket"
-- 3. Nome: nexus_files
-- 4. **IMPORTANTE**: NÃO marque "Public bucket" (deixe desmarcado/private)
-- 5. Clique em "Create bucket"
-- 6. Execute este SQL no SQL Editor

-- NOTA: Para acessar arquivos em bucket privado, use Signed URLs no frontend
-- O código em src/lib/storage.ts já deve usar createSignedUrl() em vez de getPublicUrl()
