-- Acesse o seu painel do Supabase
-- Vá em "SQL Editor" do lado esquerdo
-- Clique em "New Query" e cole o código abaixo, depois clique em RUN

-- 1. Cria a coluna 'is_active' na tabela 'stores'
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Atualiza lojistas existentes para true (garantia)
UPDATE public.stores 
SET is_active = true 
WHERE is_active IS NULL;
