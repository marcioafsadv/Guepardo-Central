-- Deletar tabelas se elas já foram criadas parcialmente (opcional, para garantir frescor)
-- DROP TABLE IF EXISTS public.messages;
-- DROP TABLE IF EXISTS public.conversations;

-- Criar tabela de conversas
-- Nota: Usamos TEXT para order_id porque a tabela deliveries usa TEXT para id
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('courier-customer', 'store-courier')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de mensagens
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_admin_intervention BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Allow authenticated read access" ON public.conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (is_admin_intervention = true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON public.conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
