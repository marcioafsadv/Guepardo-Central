-- Acesse o seu painel do Supabase
-- Vá em "SQL Editor" do lado esquerdo
-- Clique em "New Query", cole o código abaixo e clique em RUN

-- ============================================================
-- MIGRATION: add_store_welcome_bonus
-- Concede R$ 20,00 de saldo inicial para novos lojistas
-- e registra a transação de boas-vindas na carteira.
-- ============================================================

-- 1. Função para definir o saldo inicial na tabela 'stores'
CREATE OR REPLACE FUNCTION public.handle_new_store_welcome_bonus()
RETURNS TRIGGER AS $$
BEGIN
    -- Define o wallet_balance inicial para 20.00 se for NULL ou soma 20.00 ao valor inicial
    NEW.wallet_balance := COALESCE(NEW.wallet_balance, 0.00) + 20.00;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE INSERT para garantir que o saldo seja definido antes do insert ser finalizado
DROP TRIGGER IF EXISTS on_store_created_welcome_balance ON public.stores;
CREATE TRIGGER on_store_created_welcome_balance
    BEFORE INSERT ON public.stores
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_store_welcome_bonus();


-- 2. Função para registrar o log da transação em 'wallet_transactions'
CREATE OR REPLACE FUNCTION public.log_new_store_welcome_transaction()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallet_transactions (
        store_id,
        amount,
        type,
        payment_method,
        status,
        description
    ) VALUES (
        NEW.id,
        20.00,
        'RECHARGE',
        'SYSTEM',
        'CONFIRMED',
        'Crédito de Boas-Vindas - Oferta de Cadastro'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger AFTER INSERT para gravar o log após a loja ser inserida (garantindo FK de store_id válida)
DROP TRIGGER IF EXISTS on_store_created_log_welcome_transaction ON public.stores;
CREATE TRIGGER on_store_created_log_welcome_transaction
    AFTER INSERT ON public.stores
    FOR EACH ROW
    EXECUTE FUNCTION public.log_new_store_welcome_transaction();
