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
    console.log(`Identificado Collector ID: ${collectorId}`)

    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    let pixKey = (payout.pix_key || payout.withdraw_info || '').trim().replace(/[^\d\w@.-]/g, '')

    if (/^\d{10,11}$/.test(pixKey)) {
      pixKey = `+55${pixKey}`
    }

    // LISTA DE PAYLOADS PARA TESTAR (Fallback Inteligente)
    const basePayload = {
      transaction_amount: amount,
      description: `Guepardo Repasse: ${payout.profiles?.full_name || 'Entregador'}`,
      payment_method_id: 'pix',
      payer: {
        email: 'financeiro@guepardo.app',
        identification: {
          type: MP_SENDER_ID.length > 11 ? 'CNPJ' : 'CPF',
          number: MP_SENDER_ID
        }
      }
    }

    const payloadFormats = [
      // Formato A: transaction_data.pix_key (Padrão Novo)
      {
        ...basePayload,
        point_of_interaction: {
          type: 'CHECKOUT',
          transaction_data: { pix_key: pixKey }
        }
      },
      // Formato B: transaction_data.linked_to (Comum em contas Business)
      {
        ...basePayload,
        point_of_interaction: {
          type: 'CHECKOUT',
          transaction_data: {
            linked_to: { type: 'pix', parameters: { pix_key: pixKey } }
          }
        }
      },
      // Formato C: linked_to direto no point_of_interaction
      {
        ...basePayload,
        point_of_interaction: {
          type: 'CHECKOUT',
          linked_to: { type: 'pix', parameters: { pix_key: pixKey } }
        }
      }
    ]

    let lastError = 'Nenhum formato de API aceito'
    let finalResponse: any = null

    for (let i = 0; i < payloadFormats.length; i++) {
        const formatLabel = ['A (Standard)', 'B (Nested)', 'C (Interaction Linked)'][i]
        const currentIdempotency = `payout_${payoutId}_v${i}_${Date.now()}`
        
        console.log(`Tentando Formato ${formatLabel} para ${pixKey}...`)
        
        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': currentIdempotency
          },
          body: JSON.stringify(payloadFormats[i])
        })

        const responseText = await mpResponse.text()
        let responseData: any = {}
        try { responseData = JSON.parse(responseText); } catch (e) {}

        if (mpResponse.ok) {
            console.log(`SUCESSO com Formato ${formatLabel}!`)
            finalResponse = responseData
            break
        } else {
            lastError = responseData.message || (responseData.cause && responseData.cause[0]?.description) || `Erro no Formato ${formatLabel}`
            console.warn(`Formato ${formatLabel} rejeitado: ${lastError}`)
            // Se for erro de saldo ou algo real, não adianta tentar outros formatos
            if (lastError.toLowerCase().includes('balance') || lastError.toLowerCase().includes('insufficient')) {
                break
            }
        }
    }

    if (finalResponse) {
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', payoutId)

        return new Response(
          JSON.stringify({ success: true, message: 'Transferência automática realizada!', data: finalResponse }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } else {
        console.error(`Falha Total: ${lastError}`)
        
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'failed',
            error_message: lastError 
          })
          .eq('id', payoutId)

        return new Response(
          JSON.stringify({ success: false, error: lastError }),
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
