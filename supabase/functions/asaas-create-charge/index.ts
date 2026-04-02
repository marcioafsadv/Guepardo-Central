import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const supabaseClient = createClient(supabaseUrl, supabaseKey)

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
  const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3'

  try {
    const { storeId, amount } = await req.json()

    if (!storeId || !amount) {
      throw new Error('ID da loja e valor são obrigatórios')
    }

    if (amount < 20) {
      throw new Error('O valor mínimo para recarga é R$ 20,00')
    }

    // 1. Buscar dados da loja
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()

    if (storeError || !store) throw new Error('Loja não encontrada')

    let asaasCustomerId = store.asaas_customer_id

    // 2. Se não tiver ID no Asaas, cria o cliente lá
    if (!asaasCustomerId) {
      console.log(`Criando cliente Asaas para a loja: ${store.fantasy_name}`)
      const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': ASAAS_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: store.fantasy_name || store.company_name,
          cpfCnpj: store.cnpj?.replace(/[^\d]/g, ''),
          externalReference: store.id,
          notificationDisabled: true
        })
      })

      const customerData = await customerRes.json()
      if (!customerRes.ok) throw new Error(`Falha ao criar cliente no Asaas: ${JSON.stringify(customerData)}`)
      
      asaasCustomerId = customerData.id
      
      // Salva o ID no nosso banco
      await supabaseClient
        .from('stores')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', storeId)
    }

    // 3. Criar a cobrança PIX
    console.log(`Gerando cobrança de R$ ${amount} para o cliente ${asaasCustomerId}`)
    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: amount,
        dueDate: new Date().toISOString().split('T')[0],
        description: `Recarga de Saldo - Guepardo Central`,
        externalReference: `RECARGA-${Date.now()}`
      })
    })

    const paymentData = await paymentRes.json()
    if (!paymentRes.ok) throw new Error(`Falha ao gerar cobrança no Asaas: ${JSON.stringify(paymentData)}`)

    // 4. Buscar o QR Code do PIX
    const pixRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
      method: 'GET',
      headers: {
        'access_token': ASAAS_API_KEY || ''
      }
    })

    const pixData = await pixRes.json()
    if (!pixRes.ok) throw new Error('Falha ao obter QR Code do PIX')

    // 5. Registrar transação pendente no banco
    const { data: tx, error: txError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        store_id: storeId,
        amount: amount,
        type: 'RECHARGE',
        payment_method: 'PIX',
        status: 'PENDING',
        pix_qr_code: pixData.encodedImage,
        pix_copy_paste: pixData.payload,
        external_id: paymentData.id
      })
      .select()
      .single()

    if (txError) console.error('Erro ao registrar transação:', txError.message)

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: paymentData.id,
        transactionId: tx?.id,
        pixCode: pixData.payload,
        pixImage: pixData.encodedImage,
        amount: amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error(`Erro: ${error.message}`)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
