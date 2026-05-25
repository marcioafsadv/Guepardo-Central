-- ============================================
-- SQL Migration: Add Admin RLS Policy for Transactions
-- Description: Allow users with 'admin' role to view all transactions (required for Central driver balance view)
-- ============================================

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
