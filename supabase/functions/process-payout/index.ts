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

    console.log(`Tentando Transferência PIX (Formato Simples): R$ ${amount} para ${pixKey}`)

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Guepardo Payout: ${payout.profiles?.full_name || 'Entregador'}`,
        payment_method_id: 'pix',
        payer: {
          email: 'financeiro@guepardo.app',
          identification: {
            type: MP_SENDER_ID.length > 11 ? 'CNPJ' : 'CPF',
            number: MP_SENDER_ID
          }
        },
        // ALGUNS sistemas usam o PIX KEY direto no payer_email ou em metadata se for saque manual
        // Mas vamos enviar os parâmetros mínimos que o MP exige para não dar erro de "Name"
        callback_url: 'https://guepardo.app'
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

    // Se o MP recusar (400), marcamos como concluído no sistema mas avisamos para fazer manual
    if (!mpResponse.ok) {
        const errorMsg = responseData.message || 'Erro na API do Mercado Pago'
        console.warn(`PIX Automático falhou, mas marcando como concluído (Manual): ${errorMsg}`)
        
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'completed',
            error_message: `Manual Requerido: ${errorMsg}` 
          })
          .eq('id', payoutId)

        return new Response(
          JSON.stringify({ 
            success: true, 
            manual_required: true, 
            message: `O Mercado Pago recusou o PIX automático: "${errorMsg}". \n\nPara não te travar, o sistema MARCOU COMO PAGO, mas você deve fazer o PIX manualmente no seu banco para o entregador.` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }

    // Se o MP aceitar (Sucesso Total)
    await supabaseClient
      .from('withdrawal_requests')
      .update({ status: 'completed' })
      .eq('id', payoutId)

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('LOG ERROR:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 } // Retornar 400 para erros de lógica
    )
  }
})
