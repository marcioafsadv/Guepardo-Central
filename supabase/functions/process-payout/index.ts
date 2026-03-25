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

    // 3. Obter o MEU ID (Collector ID) do Mercado Pago
    const meResponse = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
    })
    const meData = await meResponse.json()
    const collectorId = meData.id

    const idempotencyKey = `payout_${payoutId}_${Date.now()}`
    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    let pixKey = (payout.pix_key || payout.withdraw_info || '').trim().replace(/[^\d\w@.-]/g, '')

    if (/^\d{10,11}$/.test(pixKey)) {
      pixKey = `+55${pixKey}`
    }

    console.log(`Iniciando Repasse Profissional (Disbursements): R$ ${amount} para ${pixKey} (Collector: ${collectorId})`)

    // TENTATIVA: Endpoint de Disbursements (Payouts de Empresa)
    const mpResponse = await fetch('https://api.mercadopago.com/v1/disbursements', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        amount: amount,
        collector_id: collectorId,
        external_reference: payoutId,
        payment_method_id: 'pix',
        pix_data: {
          key: pixKey,
          key_type: pixKey.includes('@') ? 'email' : (pixKey.startsWith('+') ? 'phone' : 'cpf')
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
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', payoutId)

        return new Response(
          JSON.stringify({ success: true, message: 'Repasse profissional realizado!', data: responseData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } else {
        const errorMsg = responseData.message || (responseData.cause && responseData.cause[0]?.description) || 'Erro na API de Repasses'
        console.error(`Falha no Repasse: ${errorMsg}`)
        
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
