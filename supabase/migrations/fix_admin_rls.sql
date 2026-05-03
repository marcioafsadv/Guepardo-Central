-- ============================================
-- FIX: Supabase RLS for Admin Management
-- Description: Allow users with 'admin' role to manage all driver data
-- Date: 2026-05-03
-- ============================================

-- 1. PROFILES: Allow Admins to manage all profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. VEHICLES: Allow Admins to manage all vehicles
DROP POLICY IF EXISTS "Admins can manage all vehicles" ON public.vehicles;
CREATE POLICY "Admins can manage all vehicles"
ON public.vehicles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. ADDRESSES: Allow Admins to manage all addresses
DROP POLICY IF EXISTS "Admins can manage all addresses" ON public.addresses;
CREATE POLICY "Admins can manage all addresses"
ON public.addresses
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. BANK ACCOUNTS: Allow Admins to manage all bank accounts
DROP POLICY IF EXISTS "Admins can manage all bank accounts" ON public.bank_accounts;
CREATE POLICY "Admins can manage all bank accounts"
ON public.bank_accounts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. STORAGE: Allow Admins to manage all documents in 'courier-documents' bucket
-- Note: We use the storage schema for this
DROP POLICY IF EXISTS "Admins can manage all documents" ON storage.objects;
CREATE POLICY "Admins can manage all documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'courier-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
