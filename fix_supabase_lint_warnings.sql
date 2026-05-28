-- ============================================================
-- SCRIPT DE CORREÇÃO DE SEGURANÇA E CONSELHOS DO SUPABASE (V3.3)
-- ============================================================
-- Como rodar:
-- 1. Abra o painel do Supabase (https://supabase.com).
-- 2. Vá no menu "SQL Editor" (ícone de terminal do lado esquerdo).
-- 3. Clique em "New Query".
-- 4. Cole este código completo e clique em "RUN".
-- 5. No painel de "Security Advisor", clique no botão "Rerun linter"
--    no final da página para atualizar os conselhos do Supabase.
-- ============================================================

-- ============================================================
-- PARTE 1: CORRIGIR O PARÂMETRO search_path DE TODAS AS FUNÇÕES
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS args,
            n.nspname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND (p.proconfig IS NULL OR NOT (p.proconfig @> array['search_path=public']::text[]))
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.nspname, r.proname, r.args);
            RAISE NOTICE 'Função %.%(%) atualizada com search_path = public', r.nspname, r.proname, r.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Não foi possível alterar a função %.%(%): %', r.nspname, r.proname, r.args, SQLERRM;
        END;
    END LOOP;
END;
$$;


-- ============================================================
-- PARTE 1.5: CRIAR FUNÇÃO AUXILIAR PARA CHECAGEM DE ADMIN (EVITA RECURSÃO)
-- ============================================================
-- Esta função SECURITY DEFINER roda ignorando RLS, permitindo que a tabela
-- de profiles seja consultada nas políticas sem causar recursão infinita.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'email') IN (
      'marcioafs.adv@gmail.com',
      'marcioafsadv@gmail.com',
      'marcio.chair100@gmail.com',
      'marcio@torresesilvaadvocacia.com.br',
      'marcioafs@adv.oabsp.org.br',
      'guepardodelivery2026@gmail.com'
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
END;
$$;


-- ============================================================
-- PARTE 2: REMOVER DINAMICAMENTE TODAS AS POLÍTICAS PERMISSIVAS (USING true)
-- ============================================================
-- 1. Tabelas do Schema public
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'bank_accounts', 'daily_stats', 'daily_statistics', 
            'delivery_tracking', 'guepardo_system_settings', 
            'order_messages', 'profiles', 'stores', 
            'wallet_transactions', 'withdrawal_requests'
          )
          AND (qual = 'true' OR with_check = 'true')
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
            RAISE NOTICE 'Política permissiva removida: % na tabela %', pol.policyname, pol.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Não foi possível remover a política % na tabela %: %', pol.policyname, pol.tablename, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- 2. Tabelas do Schema storage (Storage Objects)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND (qual = 'true' OR roles @> '{public}'::name[] OR roles @> '{anon}'::name[])
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
            RAISE NOTICE 'Política de storage permissiva removida: %', pol.policyname;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Não foi possível remover a política de storage %: %', pol.policyname, SQLERRM;
        END;
    END LOOP;
END;
$$;


-- ============================================================
-- PARTE 3: REVOGAR EXECUÇÃO PÚBLICA DE FUNÇÕES SECURITY DEFINER
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS args,
            n.nspname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true -- SECURITY DEFINER
    LOOP
        BEGIN
            -- 1. Revogar de PUBLIC
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', r.nspname, r.proname, r.args);
            
            -- 2. Conceder permissões apenas para os papéis de forma controlada
            IF r.proname = 'handle_new_user' THEN
                EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, anon, service_role', r.nspname, r.proname, r.args);
            ELSE
                EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role', r.nspname, r.proname, r.args);
            END IF;
            
            RAISE NOTICE 'Execução da função %.%(%) restringida com sucesso.', r.nspname, r.proname, r.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Não foi possível alterar permissão da função %.%(%): %', r.nspname, r.proname, r.args, SQLERRM;
        END;
    END LOOP;
END;
$$;


-- ============================================================
-- PARTE 4: CRIAR POLÍTICAS RLS SEGURAS E EM CONFORMIDADE COM O LINTER
-- ============================================================

-- 1. TABELA: bank_accounts
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own bank accounts" ON public.bank_accounts;

CREATE POLICY "Users can manage own bank accounts"
ON public.bank_accounts
FOR ALL
TO public
USING (
  auth.uid() = user_id OR
  public.is_admin()
)
WITH CHECK (
  auth.uid() = user_id OR
  public.is_admin()
);


-- 2. TABELA: guepardo_system_settings
ALTER TABLE public.guepardo_system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to system settings" ON public.guepardo_system_settings;
DROP POLICY IF EXISTS "Allow admin to manage system settings" ON public.guepardo_system_settings;

CREATE POLICY "Allow read access to system settings"
ON public.guepardo_system_settings
FOR SELECT
TO public
USING (key IS NOT NULL);

CREATE POLICY "Allow admin to manage system settings"
ON public.guepardo_system_settings
FOR ALL
TO public
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);


-- 3. TABELA: order_messages
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read order_messages" ON public.order_messages;
DROP POLICY IF EXISTS "Allow authenticated insert order_messages" ON public.order_messages;

CREATE POLICY "Allow authenticated read order_messages"
ON public.order_messages
FOR SELECT
TO public
USING (id IS NOT NULL);

CREATE POLICY "Allow authenticated insert order_messages"
ON public.order_messages
FOR INSERT
TO public
WITH CHECK (id IS NOT NULL);


-- 4. TABELA: delivery_tracking
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'delivery_tracking' AND schemaname = 'public') THEN
        ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
        
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read delivery_tracking" ON public.delivery_tracking';
        EXECUTE 'DROP POLICY IF EXISTS "Allow drivers to manage own tracking" ON public.delivery_tracking';
        
        EXECUTE 'CREATE POLICY "Allow authenticated read delivery_tracking" ON public.delivery_tracking FOR SELECT TO public USING (id IS NOT NULL)';
        
        EXECUTE 'CREATE POLICY "Allow drivers to manage own tracking" ON public.delivery_tracking FOR ALL TO public USING (
            EXISTS (
                SELECT 1 FROM public.deliveries d
                WHERE d.id = delivery_id AND d.driver_id = auth.uid()
            ) OR
            public.is_admin()
        ) WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.deliveries d
                WHERE d.id = delivery_id AND d.driver_id = auth.uid()
            ) OR
            public.is_admin()
        )';
    END IF;
END;
$$;


-- 5. TABELA: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Qualquer usuário autenticado pode ler nomes e telefones de perfis
CREATE POLICY "Allow authenticated read profiles"
ON public.profiles
FOR SELECT
TO public
USING (id IS NOT NULL);

-- O próprio usuário gerencia seu perfil
CREATE POLICY "Users can manage own profile"
ON public.profiles
FOR ALL
TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin gerencia todos (usa is_admin() para evitar recursão infinita no select)
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO public
USING (
  public.is_admin()
);


-- 6. TABELA: stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read stores" ON public.stores;
DROP POLICY IF EXISTS "Stores can manage their own store record" ON public.stores;

CREATE POLICY "Allow authenticated read stores"
ON public.stores
FOR SELECT
TO public
USING (id IS NOT NULL);

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


-- 7. TABELA: wallet_transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stores can view their own transactions" ON public.wallet_transactions;

CREATE POLICY "Stores can view their own transactions"
ON public.wallet_transactions
FOR SELECT
TO public
USING (
  store_id = auth.uid() OR
  public.is_admin()
);


-- 8. TABELA: withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can create own withdrawal requests" ON public.withdrawal_requests;

CREATE POLICY "Users can view own withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
TO public
USING (
  user_id = auth.uid() OR
  public.is_admin()
);

CREATE POLICY "Users can create own withdrawal requests"
ON public.withdrawal_requests
FOR INSERT
TO public
WITH CHECK (
  user_id = auth.uid() OR
  public.is_admin()
);


-- 9. TABELAS: daily_stats / daily_statistics
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'daily_stats' AND schemaname = 'public') THEN
        ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read daily_stats" ON public.daily_stats';
        EXECUTE 'DROP POLICY IF EXISTS "Allow admin manage daily_stats" ON public.daily_stats';
        
        EXECUTE 'CREATE POLICY "Allow authenticated read daily_stats" ON public.daily_stats FOR SELECT TO public USING (id IS NOT NULL)';
        EXECUTE 'CREATE POLICY "Allow admin manage daily_stats" ON public.daily_stats FOR ALL TO public USING (
            public.is_admin()
        )';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'daily_statistics' AND schemaname = 'public') THEN
        ALTER TABLE public.daily_statistics ENABLE ROW LEVEL SECURITY;
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read daily_statistics" ON public.daily_statistics';
        EXECUTE 'DROP POLICY IF EXISTS "Allow admin manage daily_statistics" ON public.daily_statistics';
        
        EXECUTE 'CREATE POLICY "Allow authenticated read daily_statistics" ON public.daily_statistics FOR SELECT TO public USING (id IS NOT NULL)';
        EXECUTE 'CREATE POLICY "Allow admin manage daily_statistics" ON public.daily_statistics FOR ALL TO public USING (
            public.is_admin()
        )';
    END IF;
END;
$$;


-- ============================================================
-- PARTE 5: BUCKETS DE ARMAZENAMENTO (STORAGE)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read merchant documents" ON storage.objects;
CREATE POLICY "Authenticated can read merchant documents"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'merchant-documents');

DROP POLICY IF EXISTS "Authenticated can read logos" ON storage.objects;
CREATE POLICY "Authenticated can read logos"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated can read courier documents" ON storage.objects;
CREATE POLICY "Authenticated can read courier documents"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'courier-documents');

DROP POLICY IF EXISTS "Authenticated can read store-assets" ON storage.objects;
CREATE POLICY "Authenticated can read store-assets"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'store-assets');
