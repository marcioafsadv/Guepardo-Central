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
  (auth.jwt() ->> 'email') IN (
    'marcioafs.adv@gmail.com',
    'marcioafsadv@gmail.com',
    'marcio.chair100@gmail.com',
    'marcio@torresesilvaadvocacia.com.br',
    'marcioafs@adv.oabsp.org.br'
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
