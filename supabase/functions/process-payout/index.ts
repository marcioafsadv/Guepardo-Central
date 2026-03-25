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
        profiles:user_id ( full_name, phone, cpf )
      `)
      .eq('id', payoutId)
      .single()

    if (payoutError || !payout) throw new Error('Solicitação de repasse não encontrada')

    const MP_ACCESS_TOKEN = Deno.env.get('MP_PAYOUT_ACCESS_TOKEN') || Deno.env.get('MP_ACCESS_TOKEN')
    if (!MP_ACCESS_TOKEN) throw new Error('Credencial MP_ACCESS_TOKEN não configurada.')

    // 6ª Via: Auto-identificar o Collector ID do usuário
    let collectorId = "";
    try {
      const meRes = await fetch('https://api.mercadopago.com/v1/me', {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });
      const meData = await meRes.json();
      collectorId = String(meData.id);
      console.log(`Collector ID identificado: ${collectorId}`);
    } catch (e) {
      console.log("Aviso: Não foi possível identificar o Collector ID");
    }

    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    const rawKey = (payout.pix_key || payout.withdraw_info || '').trim()
    const cleanKey = rawKey.replace(/[^\d\w@.-]/g, '')
    
    let keyType = 'email'
    if (cleanKey.includes('@')) keyType = 'email'
    else if (cleanKey.length === 11 && /^\d+$/.test(cleanKey)) keyType = 'cpf'
    else if (cleanKey.length === 14) keyType = 'cnpj'
    else if (cleanKey.length > 11 && /^\d+$/.test(cleanKey)) keyType = 'phone'
    else keyType = 'evp'

    const formattedPhone = keyType === 'phone' && !cleanKey.startsWith('+') ? `+55${cleanKey}` : cleanKey

    const commonHeaders: any = {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `payout-${payoutId}-${Date.now()}`
    };
    if (collectorId) commonHeaders['X-Collector-Id'] = collectorId;

    const attempts = [
      // Strategy 1: Payouts v1 com Collector ID (A via mais oficial)
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'MP-PAYOUT-WITH-ID',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          payout_info: { type: 'pix', value: cleanKey }
        }
      },
      // Strategy 2: Disbursements (Repasses Híbridos)
      {
        url: 'https://api.mercadopago.com/v1/disbursements',
        label: 'MP-DISBURSEMENTS',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          pix_key: cleanKey,
          description: `Repasse ${payoutId}`
        }
      },
      // Strategy 3: Transfers (Modo Carteira com cabeçalho ID)
      {
        url: 'https://api.mercadopago.com/v1/transfers',
        label: 'MP-TRANSFERS-WITH-ID',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          pix_key: formattedPhone,
          description: "Repasse Guepardo"
        }
      }
    ]

    let finalResponse = null;
    let errorDetails: string[] = [];

    for (const attempt of attempts) {
      try {
        const res = await fetch(attempt.url, {
          method: attempt.method,
          headers: commonHeaders,
          body: JSON.stringify(attempt.payload)
        })

        const data = await res.json()
        const isActuallyPaid = res.ok && (data.status === 'approved' || data.status === 'completed' || data.status === 'success')

        if (isActuallyPaid) {
          finalResponse = data
          break
        } else {
          errorDetails.push(`[${attempt.label}] ${res.status}: ${JSON.stringify(data)}`)
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
      return new Response(JSON.stringify({ 
        success: true, 
        manual_required: true, 
        error: errorDetails.join(' | '),
        message: "Falha técnica no Mercado Pago. Por favor realize o PIX manualmente.",
        payout_details: { pix_key: rawKey, amount: amount, name: payout.profiles?.full_name }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
