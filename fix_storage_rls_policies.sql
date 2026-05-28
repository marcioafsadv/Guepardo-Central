-- =========================================================================
-- SCRIPT DE CORREÇÃO: POLÍTICAS DE RLS PARA UPLOAD DE DOCUMENTOS (STORAGE)
-- =========================================================================
-- Como rodar:
-- 1. Abra o painel do Supabase (https://supabase.com).
-- 2. Vá no menu "SQL Editor" (ícone de terminal do lado esquerdo).
-- 3. Clique em "New Query".
-- 4. Cole este código completo e clique em "RUN" (ou use Ctrl + Enter).
-- =========================================================================

-- ==========================================
-- 1. BUCKET: merchant-documents
-- ==========================================
DROP POLICY IF EXISTS "Admin can upload merchant documents" ON storage.objects;
CREATE POLICY "Admin can upload merchant documents"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'merchant-documents');

DROP POLICY IF EXISTS "Admin can update merchant documents" ON storage.objects;
CREATE POLICY "Admin can update merchant documents"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'merchant-documents');

DROP POLICY IF EXISTS "Admin can delete merchant documents" ON storage.objects;
CREATE POLICY "Admin can delete merchant documents"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'merchant-documents');


-- ==========================================
-- 2. BUCKET: logos
-- ==========================================
DROP POLICY IF EXISTS "Admin can upload logos" ON storage.objects;
CREATE POLICY "Admin can upload logos"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "Admin can update logos" ON storage.objects;
CREATE POLICY "Admin can update logos"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Admin can delete logos" ON storage.objects;
CREATE POLICY "Admin can delete logos"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');


-- ==========================================
-- 3. BUCKET: courier-documents
-- ==========================================
DROP POLICY IF EXISTS "Admin can upload courier documents" ON storage.objects;
CREATE POLICY "Admin can upload courier documents"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'courier-documents');

DROP POLICY IF EXISTS "Admin can update courier documents" ON storage.objects;
CREATE POLICY "Admin can update courier documents"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'courier-documents');

DROP POLICY IF EXISTS "Admin can delete courier documents" ON storage.objects;
CREATE POLICY "Admin can delete courier documents"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'courier-documents');


-- ==========================================
-- 4. BUCKET: store-assets
-- ==========================================
DROP POLICY IF EXISTS "Admin can upload store-assets" ON storage.objects;
CREATE POLICY "Admin can upload store-assets"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Admin can update store-assets" ON storage.objects;
CREATE POLICY "Admin can update store-assets"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Admin can delete store-assets" ON storage.objects;
CREATE POLICY "Admin can delete store-assets"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'store-assets');
