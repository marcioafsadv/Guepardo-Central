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
    const rawKey = (payout.pix_key || payout.withdraw_info || '').trim().replace(/[^\d\w@.-]/g, '')
    const phoneNoPlus = rawKey.length >= 10 && rawKey.length <= 11 ? `55${rawKey}` : rawKey
    const phoneWithPlus = rawKey.length >= 10 && rawKey.length <= 11 ? `+55${rawKey}` : rawKey

    // ESTRATÉGIAS PARA TESTAR (Focando na C que foi a única reconhecida)
    const attempts = [
      // 1. Estratégia C.1: Payout Info com Value (Comum no Brasil)
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'C1-PAYOUT-VALUE',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          payout_info: {
             type: rawKey.includes('@') ? 'email' : (rawKey.length > 11 ? 'cnpj' : (rawKey.length === 11 ? 'phone' : 'evp')),
             value: rawKey.includes('@') ? rawKey : phoneNoPlus
          }
        }
      },
      // 2. Estratégia C.2: Payout Info com Value (Com + no Telefone)
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'C2-PAYOUT-VALUE-PLUS',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          payout_info: {
             type: rawKey.includes('@') ? 'email' : (rawKey.length > 11 ? 'cnpj' : (rawKey.length === 11 ? 'phone' : 'evp')),
             value: rawKey.includes('@') ? rawKey : phoneWithPlus
          }
        }
      },
      // 3. Estratégia C.3: Pix Data com phone_number (Variação detectada)
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'C3-PIX-DATA-VAR',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          pix_data: {
             key: phoneWithPlus,
             key_type: rawKey.includes('@') ? 'email' : 'phone_number'
          }
        }
      },
      // 4. Fallback A-PAYOUT: Tentando o modo PAYOUT no v1/payments denovo mas com payload limpo
      {
        url: 'https://api.mercadopago.com/v1/payments',
        label: 'A-CLEAN-PAYOUT',
        payload: {
          transaction_amount: amount,
          payment_method_id: 'pix',
          description: `Guepardo: ${payoutId}`,
          payer: { email: 'financeiro@guepardo.app' },
          point_of_interaction: { type: 'PAYOUT', transaction_data: { pix_key: phoneWithPlus } }
        }
      }
    ]

    let lastError = 'Nenhum formato aceito'
    let finalResponse: any = null

    for (const attempt of attempts) {
        const currentIdempotency = `payout_${payoutId}_${attempt.label}_${Date.now()}`
        console.log(`Tentando ${attempt.label} em ${attempt.url} para ${rawKey}...`)
        
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
                console.log(`SUCESSO com ${attempt.label}!`)
                finalResponse = responseData
                break
            } else {
                lastError = responseData.message || (responseData.cause && responseData.cause[0]?.description) || `Erro ${attempt.label}`
                console.warn(`${attempt.label} REJEITADO: ${lastError} (${responseText})`)
                
                // Se for erro de conta ou saldo, para tudo
                if (mpResponse.status === 401 || lastError.toLowerCase().includes('balance') || lastError.toLowerCase().includes('limit')) break
            }
        } catch (err: any) {
            console.error(`Falha técnica em ${attempt.label}: ${err.message}`)
        }
    }

    if (finalResponse) {
        await supabaseClient.from('withdrawal_requests')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', payoutId)

        return new Response(JSON.stringify({ success: true, message: 'Transferência realizada!', data: finalResponse }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } else {
        console.error(`Falha Total: ${lastError}`)
        await supabaseClient.from('withdrawal_requests').update({ status: 'failed', error_message: lastError }).eq('id', payoutId)
        return new Response(JSON.stringify({ success: false, error: lastError }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

  } catch (error: any) {
    console.error('LOG ERROR:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 } // Retornar 400 para erros de lógica
    )
  }
})
