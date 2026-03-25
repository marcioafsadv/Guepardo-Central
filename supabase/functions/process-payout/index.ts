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

    // MAPA DE TENTATIVAS (Smart Retry)
    const attempts = [
      // 1. Formato 'PAYOUT' (Comum em contas Business Diretas)
      {
        url: 'https://api.mercadopago.com/v1/payments',
        label: 'A-PAYOUT-TYPE',
        payload: {
          ...basePayload,
          point_of_interaction: { type: 'PAYOUT', transaction_data: { pix_key: pixKey } }
        }
      },
      // 2. Formato 'CHECKOUT' com pix_key direta (Standard)
      {
        url: 'https://api.mercadopago.com/v1/payments',
        label: 'B-CHECKOUT-STRICT',
        payload: {
          ...basePayload,
          point_of_interaction: { type: 'CHECKOUT', transaction_data: { pix_key: pixKey } }
        }
      },
      // 3. Endpoint Dedicado de Payouts (Estrutura diferente)
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'C-DEDICATED-PAYOUT',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          pix_data: {
             key: pixKey,
             key_type: pixKey.includes('@') ? 'email' : (pixKey.startsWith('+') ? 'phone' : 'cpf')
          },
          external_reference: payoutId
        }
      },
      // 4. Formato Legacy (Top level pix_key)
      {
        url: 'https://api.mercadopago.com/v1/payments',
        label: 'D-LEGACY-TOP-KEY',
        payload: { ...basePayload, pix_key: pixKey }
      }
    ]

    let lastError = 'Nenhum formato de API aceito'
    let finalResponse: any = null

    for (const attempt of attempts) {
        const currentIdempotency = `payout_${payoutId}_${attempt.label}_${Date.now()}`
        console.log(`Tentando Estratégia ${attempt.label} em ${attempt.url}...`)
        
        try {
            const mpResponse = await fetch(attempt.url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': currentIdempotency
              },
              body: JSON.stringify(attempt.payload)
            })

            const responseText = await mpResponse.text()
            let responseData: any = {}
            try { responseData = JSON.parse(responseText); } catch (e) {}

            if (mpResponse.ok) {
                console.log(`SUCESSO com Estratégia ${attempt.label}!`)
                finalResponse = responseData
                break
            } else {
                lastError = responseData.message || (responseData.cause && responseData.cause[0]?.description) || `Erro no Formato ${attempt.label}`
                console.warn(`Estratégia ${attempt.label} rejeitada: ${lastError}`)
                
                // Se for erro de PRODUTO (Saldo, Chave inexistente, etc), não adianta tentar outros formatos de JSON
                const isAuthError = mpResponse.status === 401
                const isBalanceError = lastError.toLowerCase().includes('balance') || lastError.toLowerCase().includes('saldo') || lastError.toLowerCase().includes('limit')
                if (isAuthError || isBalanceError) break
            }
        } catch (err: any) {
            console.error(`Falha técnica na Estratégia ${attempt.label}: ${err.message}`)
        }
    }

    if (finalResponse) {
        await supabaseClient.from('withdrawal_requests')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', payoutId)

        return new Response(JSON.stringify({ success: true, message: 'Repasse realizado!', data: finalResponse }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } else {
        console.error(`Falha Total após todas as tentativas: ${lastError}`)
        await supabaseClient.from('withdrawal_requests')
          .update({ status: 'failed', error_message: lastError })
          .eq('id', payoutId)

        return new Response(JSON.stringify({ success: false, error: lastError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

  } catch (error: any) {
    console.error('LOG ERROR:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 } // Retornar 400 para erros de lógica
    )
  }
})
