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
    const { storeId, amount, billingType = 'PIX', creditCard, creditCardHolderInfo } = await req.json()

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

    // 3. Criar a cobrança
    console.log(`Gerando cobrança de R$ ${amount} (${billingType}) para o cliente ${asaasCustomerId}`)
    
    const paymentRequest: any = {
      customer: asaasCustomerId,
      billingType: billingType,
      value: amount,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Recarga de Saldo - Guepardo`,
      externalReference: `RECARGA-${Date.now()}`
    }

    // Se for cartão, adiciona os dados necessários
    if (billingType === 'CREDIT_CARD' && creditCard) {
      paymentRequest.creditCard = creditCard
      paymentRequest.creditCardHolderInfo = creditCardHolderInfo || {
        name: store.fantasy_name || store.company_name,
        email: store.email || `${store.id}@guepardo.com`,
        cpfCnpj: store.cnpj?.replace(/[^\d]/g, ''),
        postalCode: store.address?.cep?.replace(/[^\d]/g, '') || '',
        addressNumber: store.address?.number || '',
        phone: store.phone?.replace(/[^\d]/g, '') || ''
      }
      paymentRequest.remoteIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1'
    }

    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentRequest)
    })

    const paymentData = await paymentRes.json()
    if (!paymentRes.ok) throw new Error(`Falha ao gerar cobrança no Asaas: ${JSON.stringify(paymentData)}`)

    // 4. Se for PIX, buscar o QR Code
    let pixData = null
    if (billingType === 'PIX') {
      const pixRes = await fetch(`${ASAAS_API_URL}/payments/${paymentData.id}/pixQrCode`, {
        method: 'GET',
        headers: {
          'access_token': ASAAS_API_KEY || ''
        }
      })
      pixData = await pixRes.json()
    }

    // 5. Registrar transação no banco
    const { data: tx, error: txError } = await supabaseClient
      .from('wallet_transactions')
      .insert({
        store_id: storeId,
        amount: amount,
        type: 'RECHARGE',
        payment_method: billingType,
        status: paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED' ? 'CONFIRMED' : 'PENDING',
        pix_qr_code: pixData?.encodedImage,
        pix_copy_paste: pixData?.payload,
        external_id: paymentData.id,
        metadata: {
          asaas_status: paymentData.status,
          billing_type: billingType
        }
      })
      .select()
      .single()

    if (txError) console.error('Erro ao registrar transação:', txError.message)
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
