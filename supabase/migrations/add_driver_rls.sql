-- ============================================
-- FIX: Supabase RLS for Driver Registration
-- Description: Allow drivers to manage their own data during and after registration
-- Date: 2026-05-04
-- ============================================

-- 1. PROFILES: Allow users to manage their own profile
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. VEHICLES: Allow users to manage their own vehicles
DROP POLICY IF EXISTS "Users can manage own vehicles" ON public.vehicles;
CREATE POLICY "Users can manage own vehicles"
ON public.vehicles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. ADDRESSES: Allow users to manage their own addresses
DROP POLICY IF EXISTS "Users can manage own addresses" ON public.addresses;
CREATE POLICY "Users can manage own addresses"
ON public.addresses
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. BANK ACCOUNTS: Allow users to manage their own bank accounts
DROP POLICY IF EXISTS "Users can manage own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can manage own bank accounts"
ON public.bank_accounts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. STORAGE: Allow users to upload to their own folder in 'courier-documents'
-- Using (storage.foldername(name))[1] to identify the user's folder
DROP POLICY IF EXISTS "Users can manage own documents" ON storage.objects;
CREATE POLICY "Users can manage own documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'courier-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
