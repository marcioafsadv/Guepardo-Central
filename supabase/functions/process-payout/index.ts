import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('URL_SUPABASE') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Header de autorização ausente')

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error(`Usuário não autenticado: ${userError?.message}`)

    const { payoutId } = await req.json()
    console.log(`Iniciando processamento do repasse: ${payoutId}`)

    const { data: payout, error: payoutError } = await supabaseClient
      .from('withdrawal_requests')
      .select(`
        *,
        profiles:user_id (
          full_name,
          phone,
          cpf
        )
      `)
      .eq('id', payoutId)
      .single()

    if (payoutError || !payout) throw new Error('Solicitação de repasse não encontrada')

    await supabaseClient.from('withdrawal_requests').update({ status: 'processing' }).eq('id', payoutId)

    const MP_ACCESS_TOKEN = Deno.env.get('MP_PAYOUT_ACCESS_TOKEN') || Deno.env.get('MP_ACCESS_TOKEN')
    if (!MP_ACCESS_TOKEN) throw new Error('Credencial MP_PAYOUT_ACCESS_TOKEN não configurada.')

    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    const rawKey = (payout.pix_key || payout.withdraw_info || '').trim()
    const cleanKey = rawKey.replace(/[^\d\w@.-]/g, '')
    
    let keyType = 'email'
    if (cleanKey.includes('@')) keyType = 'email'
    else if (cleanKey.length === 11 && /^\d+$/.test(cleanKey)) keyType = 'cpf'
    else if (cleanKey.length === 14) keyType = 'cnpj'
    else if (cleanKey.length > 11 && /^\d+$/.test(cleanKey)) keyType = 'phone'
    else keyType = 'evp'

    const receiverCPF = (payout.profiles?.cpf || '').replace(/\D/g, '')
    const identificationType = receiverCPF.length === 14 ? 'CNPJ' : 'CPF'
    const formattedPhone = keyType === 'phone' && !cleanKey.startsWith('+') ? `+55${cleanKey}` : cleanKey

    const attempts = [
      // Strategy 1: Transfers (Manual / Wallet to Wallet/Pix)
      {
        url: 'https://api.mercadopago.com/v1/transfers',
        label: 'MP-TRANSFERS-CLEAN',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          pix_key: cleanKey, // Tentativa 1: Apenas os 11 dígitos
          description: `Repasse Guepardo - ${payoutId}`
        }
      },
      // Strategy 2: Transfers (Com Formatação do Usuário)
      {
        url: 'https://api.mercadopago.com/v1/transfers',
        label: 'MP-TRANSFERS-FORMATTED',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          pix_key: rawKey, // Tentativa 2: (11) 98749-9545 (como sugerido)
          description: `Repasse Guepardo`
        }
      },
      // Strategy 3: Transfers (Com +55)
      {
        url: 'https://api.mercadopago.com/v1/transfers',
        label: 'MP-TRANSFERS-INTL',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          pix_key: formattedPhone, // Tentativa 3: +5511987499545
          description: `Repasse Guepardo`
        }
      },
      // Strategy 4: Money Out Payouts (Alternative Official)
      {
        url: 'https://api.mercadopago.com/v1/money_out/payouts',
        label: 'MP-MONEY-OUT',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          payout_info: {
             type: keyType === 'evp' ? 'random_key' : keyType,
             value: formattedPhone
          }
        }
      },
      // Strategy 3: Payouts v1 (Tipo Simplificado)
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'MP-DISPERSAO-SIMPLIFIED',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          payout_info: {
             type: 'pix',
             value: cleanKey
          }
        }
      }
    ]

    let finalResponse = null
    let errorDetails: string[] = []

    for (const attempt of attempts) {
      console.log(`Tentando ${attempt.label}...`)
      try {
        const res = await fetch(attempt.url, {
          method: attempt.method,
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `payout-${payoutId}-${attempt.label}-${Date.now()}`
          },
          body: JSON.stringify(attempt.payload)
        })

        const data = await res.json()
        const isActuallyPaid = res.ok && (data.status === 'approved' || data.status === 'completed' || data.status === 'success')

        if (isActuallyPaid) {
          finalResponse = data
          break
        } else {
          const detail = res.ok ? `Pendente (${data.status})` : `${res.status}: ${JSON.stringify(data)}`
          errorDetails.push(`[${attempt.label}] ${detail}`)
          if (res.status === 401 || res.status === 403) break
        }
      } catch (err: any) {
        errorDetails.push(`[${attempt.label}] Erro: ${err.message}`)
      }
    }

    if (finalResponse) {
      await supabaseClient.from('withdrawal_requests')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', payoutId)
      return new Response(JSON.stringify({ success: true, data: finalResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } else {
      const lastError = errorDetails.join(' | ')
      await supabaseClient.from('withdrawal_requests').update({ status: 'failed', error_message: lastError }).eq('id', payoutId)
      return new Response(JSON.stringify({ success: false, error: lastError }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
