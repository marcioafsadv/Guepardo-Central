import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getPixKeyType(key: string): { type: string, key: string } {
  const cleanKey = key.replace(/[^\d\w@.-]/g, '')
  
  // 1. E-mail
  if (cleanKey.includes('@')) return { type: 'EMAIL', key: cleanKey }
  
  // 2. CNPJ (14 dígitos)
  if (/^\d{14}$/.test(cleanKey)) return { type: 'CNPJ', key: cleanKey }
  
  // 3. Telefone ou CPF (ambos com 11 dígitos)
  if (cleanKey.length === 11) {
    // Se começa com DDD (11-99) e o terceiro dígito é 9, é celular
    if (/^[1-9][1-9]9/.test(cleanKey)) {
      return { type: 'PHONE', key: `+55${cleanKey}` }
    }
    // Caso contrário, assumimos CPF
    return { type: 'CPF', key: cleanKey }
  }
  
  // 4. Telefone fixo com DDD (10 dígitos)
  if (cleanKey.length === 10 && /^[1-9][1-9]/.test(cleanKey)) {
    return { type: 'PHONE', key: `+55${cleanKey}` }
  }
  
  return { type: 'EVP', key: cleanKey } // Chave aleatória
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const supabaseClient = createClient(supabaseUrl, supabaseKey)
  
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
  const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3'

  let currentPayoutId = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Header de autorização ausente')

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error(`Não autenticado: ${userError?.message}`)

    const { payoutId } = await req.json()
    currentPayoutId = payoutId
    console.log(`[START] Asaas Payout ID: ${payoutId}`)

    // 1. Marcar como processando
    await supabaseClient.from('withdrawal_requests').update({ status: 'processing' }).eq('id', payoutId)

    // 2. Buscar dados do repasse e do perfil do entregador
    const { data: payout, error: payoutError } = await supabaseClient
      .from('withdrawal_requests')
      .select('*, profiles:user_id(full_name, phone, cpf)')
      .eq('id', payoutId)
      .single()

    if (payoutError || !payout) throw new Error('Repasse não encontrado.')

    const amount = parseFloat(String(payout.amount).replace(',', '.'))
    const rawKey = (payout.pix_key || payout.withdraw_info || '').trim()
    const { type: pixType, key: cleanKey } = getPixKeyType(rawKey)

    console.log(`Tentando transferência Asaas: R$ ${amount} para chave ${pixType}: ${cleanKey}`)

    // 3. Executar transferência no Asaas
    const res = await fetch(`${ASAAS_API_URL}/transfers`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: amount,
        pixAddressKey: cleanKey,
        pixAddressKeyType: pixType,
        description: `Repasse Entregador - Guepardo Central (Ref: ${payoutId})`
      })
    })

    const data = await res.json()

    if (res.ok && (data.status === 'DONE' || data.status === 'AWAITING_APPROVAL' || data.status === 'PENDING' || data.status === 'BANK_PROCESSING')) {
      // Sucesso ou Pendente
      await supabaseClient
        .from('withdrawal_requests')
        .update({ 
          status: 'completed', 
          processed_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', payoutId)

      return new Response(JSON.stringify({ 
        success: true, 
        data: data,
        message: `Repasse enviado via Asaas! Status: ${data.status}`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else {
      // Falha automática -> Ativar Manual Fallback
      let errorMsg = data.errors?.[0]?.description || data.error || 'Erro desconhecido na API do Asaas'
      console.error(`Falha Asaas: ${errorMsg}`)
      
      return new Response(JSON.stringify({ 
        success: true, 
        manual_required: true, 
        error: errorMsg,
        payout_details: { 
          pix_key: rawKey, 
          amount: amount, 
          name: payout.profiles?.full_name || 'Entregador' 
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (error: any) {
    console.error(`Erro Fatal Payout: ${error.message}`)
    if (currentPayoutId) {
       await supabaseClient
        .from('withdrawal_requests')
        .update({ status: 'pending', error_message: error.message })
        .eq('id', currentPayoutId)
    }
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
