-- ============================================================
-- RPC: approve_manual_recharge
-- Aprova uma recarga manual:
--   1. Credita o saldo na carteira da loja
--   2. Atualiza o status da transação para 'CONFIRMED'
-- Executa com SECURITY DEFINER para bypassar RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION approve_manual_recharge(
    transaction_id  UUID,
    target_store_id UUID,
    amount_to_add   NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Creditar o saldo
    UPDATE stores
    SET wallet_balance = COALESCE(wallet_balance, 0) + amount_to_add
    WHERE id = target_store_id;

    -- 2. Atualizar status da transação
    UPDATE wallet_transactions
    SET status = 'CONFIRMED'
    WHERE id = transaction_id;
END;
$$;

-- Garantir que somente roles autenticados possam chamar
REVOKE EXECUTE ON FUNCTION approve_manual_recharge(UUID, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_manual_recharge(UUID, UUID, NUMERIC) TO authenticated;


-- ============================================================
-- RPC: reject_manual_recharge
-- Recusa uma recarga manual:
--   1. Atualiza o status da transação para 'CANCELLED'
-- ============================================================
CREATE OR REPLACE FUNCTION reject_manual_recharge(
    transaction_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE wallet_transactions
    SET status = 'CANCELLED'
    WHERE id = transaction_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION reject_manual_recharge(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_manual_recharge(UUID) TO authenticated;
