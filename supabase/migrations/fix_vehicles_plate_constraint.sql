-- ============================================
-- FIX: vehicles_plate_key unique constraint error
-- Problema: A constraint UNIQUE na coluna 'plate' impede que um entregador
-- re-tente o cadastro ou que dois cadastros usem a mesma placa (ex: coproprietário).
-- Solução: Remover o UNIQUE da plate isolado e manter apenas o UNIQUE(user_id).
-- Também garante que a coluna proof_of_residence_url existe.
-- Date: 2026-05-04
-- ============================================

-- 1. Remover a constraint UNIQUE da placa (vehicles_plate_key)
--    Nota: O nome da constraint pode variar. Tentamos os nomes mais comuns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vehicles_plate_key'
      AND table_name = 'vehicles'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_plate_key;
    RAISE NOTICE 'Constraint vehicles_plate_key removida com sucesso.';
  ELSE
    RAISE NOTICE 'Constraint vehicles_plate_key não encontrada, pulando.';
  END IF;
END $$;

-- 2. Também remover o índice único criado para a placa (caso exista separado)
DROP INDEX IF EXISTS idx_vehicles_plate;

-- 3. Recriar o índice como NÃO-ÚNICO (apenas para performance de busca)
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(plate);

-- 4. Garantir que a coluna proof_of_residence_url existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles'
      AND column_name = 'proof_of_residence_url'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.vehicles ADD COLUMN proof_of_residence_url TEXT;
    RAISE NOTICE 'Coluna proof_of_residence_url adicionada à tabela vehicles.';
  ELSE
    RAISE NOTICE 'Coluna proof_of_residence_url já existe na tabela vehicles.';
  END IF;
END $$;

-- 5. Verificar estado final das constraints da tabela vehicles
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.vehicles'::regclass
ORDER BY contype;
