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
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error(`Configuração do Supabase incompleta: URL=${!!supabaseUrl}, Key=${!!supabaseKey}`)
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // 0. Validar o Usuário (Manual JWT Validation)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Header de autorização ausente')
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (userError || !user) {
      console.error('Erro de Autenticação:', userError)
      throw new Error(`Usuário não autenticado ou token inválido: ${userError?.message || 'Sem sessão'}`)
    }

    const { payoutId } = await req.json()
    console.log(`Iniciando processamento do repasse: ${payoutId}`)

    // 1. Obter dados do repasse
    const { data: payout, error: payoutError } = await supabaseClient
      .from('withdrawal_requests')
      .select(`
        *,
        profiles:user_id (
          full_name,
          phone
        )
      `)
      .eq('id', payoutId)
      .single()

    if (payoutError || !payout) {
      throw new Error(`Solicitação de repasse não encontrada: ${payoutError?.message || 'Sem dados'}`)
    }

    if (payout.status === 'completed') {
      throw new Error(`Esta solicitação já está em estado: ${payout.status}`)
    }

    // 2. Marcar como processando no banco
    await supabaseClient
      .from('withdrawal_requests')
      .update({ status: 'processing' })
      .eq('id', payoutId)

    // 3. Credenciais do Mercado Pago
    const MP_PAYOUT_ACCESS_TOKEN = Deno.env.get('MP_PAYOUT_ACCESS_TOKEN')
    const MP_LEGACY_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
    const MP_ACCESS_TOKEN = MP_PAYOUT_ACCESS_TOKEN || MP_LEGACY_TOKEN
    
    if (!MP_ACCESS_TOKEN) {
      throw new Error('Nenhuma credencial do Mercado Pago encontrada.')
    }

    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    const rawKey = (payout.pix_key || payout.withdraw_info || '').trim()
    const cleanKey = rawKey.replace(/[^\d\w@.-]/g, '')
    
    // Identificar tipo de chave
    let keyType = 'email'
    if (cleanKey.includes('@')) keyType = 'email'
    else if (cleanKey.length === 11) keyType = 'cpf'
    else if (cleanKey.length === 14) keyType = 'cnpj'
    else if (cleanKey.length > 11 && /^\d+$/.test(cleanKey)) keyType = 'phone'
    else keyType = 'evp'

    console.log(`Processando Repasse R$ ${amount} para chave [${keyType}]: ${cleanKey}`)

    // ESTRATÉGIAS DE REPASSE
    const attempts = [
      // Strategy 1: Dispersão Oficial (Payouts v1) - O MAIS PROVÁVEL
      {
        url: 'https://api.mercadopago.com/v1/payouts',
        label: 'MP-DISPERSAO-V1',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          payout_info: {
             type: keyType,
             value: keyType === 'phone' && !cleanKey.startsWith('+') ? `+${cleanKey}` : cleanKey
          }
        }
      },
      // Strategy 2: Payments API com Operation Type: Payout (Alternativo)
      {
        url: 'https://api.mercadopago.com/v1/payments',
        label: 'MP-PAYMENTS-DISBURSEMENT',
        method: 'POST',
        payload: {
          transaction_amount: amount,
          payment_method_id: 'pix',
          operation_type: 'payout',
          description: `Repasse Guepardo - ${payoutId}`,
          payer: {
             email: payout.profiles?.email || 'financeiro@guepardo.delivery',
             identification: {
                type: keyType === 'cpf' || keyType === 'cnpj' ? keyType.toUpperCase() : 'CPF',
                number: keyType === 'cpf' || keyType === 'cnpj' ? cleanKey : '00000000000'
             }
          },
          payout: {
              type: keyType,
              value: cleanKey
          }
        }
      }
    ]

    let finalResponse = null
    let lastError = ''

    for (const attempt of attempts) {
      console.log(`Tentando Estratégia: ${attempt.label}...`)
      try {
        const res = await fetch(attempt.url, {
          method: attempt.method,
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `payout-${payoutId}-${attempt.label}`
          },
          body: JSON.stringify(attempt.payload)
        })

        const data = await res.json()

        if (res.ok) {
          console.log(`Sucesso com ${attempt.label}! ID: ${data.id}`)
          finalResponse = data
          break
        } else {
          lastError = `[${attempt.label}] ${res.status}: ${JSON.stringify(data)}`
          console.error(`Falha na estratégia ${attempt.label}:`, lastError)
          
          // Se for erro de autorização absoluta, não adianta tentar outras
          if (res.status === 401) break
        }
      } catch (err: any) {
        lastError = `[${attempt.label}] Erro de Rede: ${err.message}`
        console.error(lastError)
      }
    }

    if (finalResponse) {
      await supabaseClient.from('withdrawal_requests')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', payoutId)

      return new Response(JSON.stringify({ success: true, message: 'Repasse realizado com sucesso!', data: finalResponse }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } else {
      console.error(`FALHA TOTAL NO REPASSE: ${lastError}`)
      await supabaseClient.from('withdrawal_requests').update({ status: 'failed', error_message: lastError }).eq('id', payoutId)
      return new Response(JSON.stringify({ success: false, error: lastError }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

  } catch (error: any) {
    console.error('ERRO CRÍTICO:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
