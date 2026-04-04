import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const supabaseClient = createClient(supabaseUrl, supabaseKey)

  try {
    const { storeId, amount, description } = await req.json()

    if (!storeId || !amount) {
      throw new Error('ID da loja e valor são obrigatórios')
    }

    if (amount < 20) {
      throw new Error('O valor mínimo para recarga é R$ 20,00')
    }

    console.log(`Registrando recarga MANUAL (Mercado Pago) para a loja: ${storeId} | Valor: R$ ${amount}`)

    // Registrar transação PENDING diretamente no banco
    const { data: tx, error: txError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        store_id: storeId,
        amount: Number(amount),
        type: 'RECHARGE',
        payment_method: 'MANUAL',
        status: 'PENDING',
        description: description || 'Recarga Manual (Transferência Informada pelo Lojista)',
        metadata: {
          manual_payout: true,
          gateway: 'Mercado Pago',
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (txError) {
      console.error('Erro ao inserir transação:', txError.message)
      throw new Error(`Falha ao registrar recarga: ${txError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: tx.id,
        amount: amount,
        message: 'Solicitação de recarga registrada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error(`Erro na recarga manual: ${error.message}`)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
