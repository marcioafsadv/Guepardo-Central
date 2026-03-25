import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('URL_SUPABASE') || ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const supabaseClient = createClient(supabaseUrl, supabaseKey)
  
  let currentPayoutId = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Header de autorização ausente')

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error(`Não autenticado: ${userError?.message}`)

    const { payoutId } = await req.json()
    currentPayoutId = payoutId
    console.log(`[START] Payout ID: ${payoutId}`)

    // 1. Marcar como processando no banco para evitar cliques duplos
    await supabaseClient.from('withdrawal_requests').update({ status: 'processing' }).eq('id', payoutId)

    // 2. Buscar dados (com timeout manual de 5s para o banco)
    const { data: payout, error: payoutError } = await supabaseClient
      .from('withdrawal_requests')
      .select('*, profiles:user_id(full_name, phone, cpf)')
      .eq('id', payoutId)
      .single()

    if (payoutError || !payout) throw new Error('Repasse não encontrado ou erro de permissão.')

    const MP_ACCESS_TOKEN = Deno.env.get('MP_PAYOUT_ACCESS_TOKEN') || Deno.env.get('MP_ACCESS_TOKEN')
    if (!MP_ACCESS_TOKEN) throw new Error('Token MP não configurado.')

    // 3. Auto-ID do Collector (Com Timeout de 5s)
    let collectorId = ""
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const meRes = await fetch('https://api.mercadopago.com/v1/me', {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const meData = await meRes.json()
      collectorId = String(meData.id)
      console.log(`Collector ID: ${collectorId}`)
    } catch (e) { console.log("Aviso: Falha no Auto-ID") }

    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    const rawKey = (payout.pix_key || payout.withdraw_info || '').trim()
    const cleanKey = rawKey.replace(/[^\d\w@.-]/g, '')
    const formattedPhone = (cleanKey.length >= 10 && /^\d+$/.test(cleanKey) && !cleanKey.startsWith('+')) ? `+55${cleanKey}` : cleanKey

    const commonHeaders: any = {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `payout-${payoutId}-${Date.now()}`
    }
    if (collectorId) commonHeaders['X-Collector-Id'] = collectorId

    const attempts = [
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'STRAT-PAYOUT',
        method: 'POST',
        payload: { amount, payment_method_id: 'pix', payout_info: { type: 'pix', value: cleanKey } }
      },
      {
        url: 'https://api.mercadopago.com/v1/transfers',
        label: 'STRAT-TRANSFER',
        method: 'POST',
        payload: { amount, payment_method_id: 'pix', pix_key: formattedPhone }
      }
    ]

    let finalResponse = null
    let errorDetails: string[] = []

    for (const attempt of attempts) {
      console.log(`Tentando ${attempt.label}...`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s per attempt
      
      try {
        const res = await fetch(attempt.url, {
          method: attempt.method,
          headers: commonHeaders,
          body: JSON.stringify(attempt.payload),
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        const data = await res.json()
        const isPaid = res.ok && (data.status === 'approved' || data.status === 'completed' || data.status === 'success')

        if (isPaid) {
          finalResponse = data
          break
        } else {
          errorDetails.push(`${attempt.label}: ${res.status}`)
        }
      } catch (err: any) {
        errorDetails.push(`${attempt.label}: Timeout/Erro`)
      }
    }

    if (finalResponse) {
      await supabaseClient.from('withdrawal_requests').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', payoutId)
      return new Response(JSON.stringify({ success: true, data: finalResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else {
      // Falha automática -> Ativar Manual Fallback
      return new Response(JSON.stringify({ 
        success: true, 
        manual_required: true, 
        error: errorDetails.join(' | '),
        payout_details: { pix_key: rawKey, amount: amount, name: payout.profiles?.full_name || 'Entregador' }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (error: any) {
    console.error(`Erro Fatal: ${error.message}`)
    if (currentPayoutId) {
       // Se deu erro fatal, volta para pendente para não travar a lista
       await supabaseClient.from('withdrawal_requests').update({ status: 'pending', error_message: error.message }).eq('id', currentPayoutId)
    }
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
