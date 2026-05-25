-- ============================================
-- SQL Migration: Add Admin RLS Policy for Transactions
-- Description: Allow users with 'admin' role OR the owner email to view all transactions
-- ============================================

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'marcioafsadv@gmail.com' OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
