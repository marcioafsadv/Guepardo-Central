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

  const WEBHOOK_SECRET = Deno.env.get('ASAAS_WEBHOOK_SECRET')

  try {
    // 1. Validar Token de Segurança (Opcional mas recomendado)
    const asaasToken = req.headers.get('asaas-access-token')
    if (WEBHOOK_SECRET && asaasToken !== WEBHOOK_SECRET) {
      console.error('Webhook não autorizado: Token inválido')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { event, payment } = await req.json()
    console.log(`Recebido evento Asaas: ${event} para o pagamento ${payment?.id}`)

    // 2. Processar apenas pagamentos recebidos ou confirmados
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const asaasCustomerId = payment.customer
      const amount = payment.value

      // 3. Buscar a loja pelo ID do cliente Asaas
      const { data: store, error: storeError } = await supabaseClient
        .from('stores')
        .select('id, wallet_balance')
        .eq('asaas_customer_id', asaasCustomerId)
        .single()

      if (storeError || !store) {
        console.error(`Loja não encontrada para o asaas_customer_id: ${asaasCustomerId}`)
        return new Response('Store not found', { status: 200 }) // Respondemos 200 pro Asaas não re-tentar erro
      }

      const newBalance = (store.wallet_balance || 0) + amount

      // 4. Atualizar o saldo da loja
      const { error: updateError } = await supabaseClient
        .from('stores')
        .update({ wallet_balance: newBalance })
        .eq('id', store.id)

      if (updateError) {
        console.error(`Erro ao atualizar saldo da loja ${store.id}: ${updateError.message}`)
        throw updateError
      }

      // 5. Atualizar a transação para CONCLUÍDO
      const { error: txUpdateError } = await supabaseClient
        .from('wallet_transactions')
        .update({ status: 'CONFIRMED' })
        .eq('external_id', payment.id)
        .eq('status', 'PENDING')

      if (txUpdateError) console.error(`Erro ao confirmar transação ${payment.id}: ${txUpdateError.message}`)

      console.log(`[SUCCESS] Saldo da loja ${store.id} atualizado: +R$ ${amount} (Novo saldo: R$ ${newBalance})`)
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error: any) {
    console.error(`Erro no Webhook: ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
