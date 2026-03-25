import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { payoutId } = await req.json()

    // 0. Validar o Usuário (Manual JWT Validation)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Header de autorização ausente')
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado ou token inválido')
    }

    // Opcional: Validar se o usuário é admin se tivermos um campo role
    // if (user.email !== 'seu-email-admin@gmail.com') throw new Error('Acesso negado')

    // 1. Buscar os detalhes do repasse
    const { data: payout, error: payoutError } = await supabaseClient
      .from('withdrawal_requests')
      .select(`
        *,
        profiles (
          full_name,
          phone
        )
      `)
      .eq('id', payoutId)
      .single()

    if (payoutError || !payout) {
      throw new Error('Solicitação de repasse não encontrada')
    }

    if (payout.status !== 'pending' && payout.status !== 'failed') {
      throw new Error(`Esta solicitação já está em estado: ${payout.status}`)
    }

    // 2. Atualizar status para processando
    await supabaseClient
      .from('withdrawal_requests')
      .update({ status: 'processing' })
      .eq('id', payoutId)

    // 3. Chamar API do Mercado Pago (PIX Payout / Transfer - Simplificado)
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
    const MP_SENDER_ID = Deno.env.get('MP_SENDER_ID')?.replace(/[^\d]/g, '') || '00000000000000'
    
    if (!MP_ACCESS_TOKEN) {
      throw new Error('Secret MP_ACCESS_TOKEN não encontrada. Configure no Supabase.')
    }

    const idempotencyKey = `payout_${payoutId}_${Date.now()}`
    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    const pixKey = (payout.pix_key || payout.withdraw_info || '').trim()

    console.log(`Tentando Transferência Automática: R$ ${amount} para ${pixKey}`)

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Guepardo Automatizado: ${payout.profiles?.full_name || 'Entregador'}`,
        payment_method_id: 'pix',
        payer: {
          email: 'financeiro@guepardo.app',
          identification: {
            type: MP_SENDER_ID.length > 11 ? 'CNPJ' : 'CPF',
            number: MP_SENDER_ID
          }
        },
        point_of_interaction: {
          type: 'CHECKOUT',
          transaction_data: {
            linked_to: {
              type: 'pix',
              parameters: {
                 pix_key: pixKey
              }
            }
          }
        }
      })
    })

    const responseText = await mpResponse.text()
    console.log('Resposta bruta do Mercado Pago:', responseText)

    let responseData: any = {}
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      console.error('Falha ao processar JSON de resposta do MP')
    }

    if (mpResponse.ok) {
        // SUCESSO REAL - Pagamento Realizado
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', payoutId)

        return new Response(
          JSON.stringify({ success: true, message: 'Transferência automática realizada com sucesso!', data: responseData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } else {
        const errorMsg = responseData.message || (responseData.cause && responseData.cause[0]?.description) || 'Erro na API do Mercado Pago'
        console.error(`Falha no Automático: ${errorMsg}`)
        
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'failed',
            error_message: errorMsg 
          })
          .eq('id', payoutId)

        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

  } catch (error: any) {
    console.error('LOG ERROR:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 } // Retornar 400 para erros de lógica
    )
  }
})
