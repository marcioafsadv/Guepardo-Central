-- 1. Cria as colunas de onboarding na tabela 'stores'
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS document_url text,
ADD COLUMN IF NOT EXISTS contract_url text,
ADD COLUMN IF NOT EXISTS location_photo_url text,
ADD COLUMN IF NOT EXISTS onboarding_notes text;

-- 2. Atualiza lojistas existentes para status 'approved' (opcional, para não bloquear lojistas antigos)
UPDATE public.stores 
SET onboarding_status = 'approved' 
WHERE onboarding_status IS NULL;
