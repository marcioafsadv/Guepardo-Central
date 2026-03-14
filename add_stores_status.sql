-- Acesse o seu painel do Supabase
-- Vá em "SQL Editor" do lado esquerdo
-- Clique em "New Query" e cole o código abaixo, depois clique em RUN

-- 1. Cria a coluna 'status' na tabela 'stores'
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';

-- 2. Atualiza lojistas vazios para open (garantia dupla)
UPDATE public.stores 
SET status = 'open' 
WHERE status IS NULL;
