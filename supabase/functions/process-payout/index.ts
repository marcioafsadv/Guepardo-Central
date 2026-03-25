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

    // 1. Obter dados do repasse + Perfil com CPF
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

    if (payoutError || !payout) {
      throw new Error(`Solicitação de repasse não encontrada: ${payoutError?.message || 'Sem dados'}`)
    }

    // 2. Marcar como processando
    await supabaseClient
      .from('withdrawal_requests')
      .update({ status: 'processing' })
      .eq('id', payoutId)

    // 3. Credenciais MP
    const MP_ACCESS_TOKEN = Deno.env.get('MP_PAYOUT_ACCESS_TOKEN') || Deno.env.get('MP_ACCESS_TOKEN')
    
    if (!MP_ACCESS_TOKEN) {
      throw new Error('Credencial MP_PAYOUT_ACCESS_TOKEN não configurada.')
    }

    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    const rawKey = (payout.pix_key || payout.withdraw_info || '').trim()
    const cleanKey = rawKey.replace(/[^\d\w@.-]/g, '')
    
    // Identificar tipo de chave
    let keyType = 'email'
    if (cleanKey.includes('@')) keyType = 'email'
    else if (cleanKey.length === 11 && /^\d+$/.test(cleanKey)) keyType = 'cpf'
    else if (cleanKey.length === 14) keyType = 'cnpj'
    else if (cleanKey.length > 11 && /^\d+$/.test(cleanKey)) keyType = 'phone'
    else keyType = 'evp'

    // Obter Identificação Real (Importante para evitar "Invalid identification")
    const receiverCPF = (payout.profiles?.cpf || '').replace(/\D/g, '')
    const receiverEmail = 'financeiro@guepardo.delivery'
    const identificationType = receiverCPF.length === 14 ? 'CNPJ' : 'CPF'

    console.log(`Processando R$ ${amount} para ${payout.profiles?.full_name} | Chave: ${cleanKey} | CPF: ${receiverCPF}`)

    const attempts = [
      // Strategy 1: Dispersão Oficial (Payouts v1)
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
      // Strategy 2: Payments API com Identificação REAL (Resolver erro 2067)
      {
        url: 'https://api.mercadopago.com/v1/payments',
        label: 'MP-PAYMENTS-REAL-ID',
        method: 'POST',
        payload: {
          transaction_amount: amount,
          payment_method_id: 'pix',
          description: `Repasse Guepardo - ${payoutId}`,
          payer: {
             email: receiverEmail,
             identification: {
                type: identificationType,
                number: receiverCPF || '00000000000' // Backup, mas idealmente deve ter CPF
             }
          }
        }
      },
      // Strategy 3: Wallet Payouts (Transferência Direta)
      {
        url: 'https://api.mercadopago.com/v1/wallet_payouts',
        label: 'MP-WALLET-PAYOUT',
        method: 'POST',
        payload: {
          amount: amount,
          payment_method_id: 'pix',
          payout_info: {
            type: keyType,
            value: cleanKey
          }
        }
      }
    ]

    let finalResponse = null
    let errorDetails: string[] = []

    for (const attempt of attempts) {
      if (attempt.label === 'MP-PAYMENTS-REAL-ID' && !receiverCPF) {
          errorDetails.push("[MP-PAYMENTS-REAL-ID] Ignored: Sem CPF no perfil do entregador")
          continue
      }

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

        if (res.ok) {
          console.log(`Sucesso com ${attempt.label}! ID: ${data.id}`)
          finalResponse = data
          break
        } else {
          const errorMsg = `[${attempt.label}] ${res.status}: ${JSON.stringify(data)}`
          errorDetails.push(errorMsg)
          console.error(`Falha em ${attempt.label}:`, errorMsg)
          
          if (res.status === 401 || res.status === 403) break
        }
      } catch (err: any) {
        errorDetails.push(`[${attempt.label}] Erro de Rede: ${err.message}`)
      }
    }

    if (finalResponse) {
      await supabaseClient.from('withdrawal_requests')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', payoutId)

      return new Response(JSON.stringify({ success: true, message: 'Repasse realizado com sucesso!', data: finalResponse }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } else {
      const lastError = errorDetails.join(' | ')
      console.error(`FALHA TOTAL: ${lastError}`)
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
