-- =========================================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA: PERMISSÕES DE ADMIN E RLS DE LOJISTAS
-- =========================================================================
-- Como rodar:
-- 1. Abra o painel do Supabase (https://supabase.com).
-- 2. Vá no menu "SQL Editor" (ícone de terminal do lado esquerdo).
-- 3. Clique em "New Query".
-- 4. Cole este código completo e clique em "RUN" (ou use Ctrl + Enter).
-- =========================================================================

-- 1. CONFIGURA O PERFIL DO MÁRCIO E OUTROS ADMINS PARA A VALIDAÇÃO RLS
-- Isto garante que, mesmo que a leitura do e-mail do JWT (auth.jwt()) falhe,
-- o banco reconhecerá a conta como administradora através do auth.uid() de forma segura.
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'marcioafs.adv@gmail.com',
    'marcioafsadv@gmail.com',
    'marcio.chair100@gmail.com',
    'marcio@torresesilvaadvocacia.com.br',
    'marcioafs@adv.oabsp.org.br'
  )
);

-- 2. RECRIA A FUNÇÃO AUXILIAR DE VERIFICAÇÃO DE ADMIN (MANTENDO SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    coalesce((auth.jwt() ->> 'email'), '') IN (
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
END;
$$;

-- 3. LIMPA E RECONSTRÓI AS POLÍTICAS DE RLS NA TABELA DE LOJISTAS (stores)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas que possam causar conflito
DROP POLICY IF EXISTS "Allow authenticated read stores" ON public.stores;
DROP POLICY IF EXISTS "Stores can manage their own store record" ON public.stores;
DROP POLICY IF EXISTS "Admins can manage all stores" ON public.stores;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stores;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.stores;

-- Permite leitura de estabelecimentos por qualquer usuário autenticado ou anônimo
CREATE POLICY "Allow authenticated read stores"
ON public.stores
FOR SELECT
TO public
USING (id IS NOT NULL);

-- Permite gerenciamento completo (SELECT, INSERT, UPDATE, DELETE) 
-- para o próprio lojista (id = auth.uid()) OU para qualquer administrador
CREATE POLICY "Stores can manage their own store record"
ON public.stores
FOR ALL
TO public
USING (
  id = auth.uid() OR
  public.is_admin()
)
WITH CHECK (
  id = auth.uid() OR
  public.is_admin()
);
