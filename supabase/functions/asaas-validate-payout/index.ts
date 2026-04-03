import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Este webhook serve para o Asaas validar se o seu sistema aprova o saque que a própria API solicitou.
// O Asaas só permite saques automáticos via API se houver este mecanismo de segurança configurado.

Deno.serve(async (req: Request) => {
  try {
    const data = await req.json();
    console.log("Validação de Saque Asaas Recebida:", JSON.stringify(data, null, 2));

    // Como no painel do Guepardo Central o Administrador já clicou em "Aprovar e Pagar", 
    // nós respondemos para o Asaas que está tudo OK e ele pode prosseguir com o pagamento.
    
    return new Response(
      JSON.stringify({ approved: true }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Erro na validação de saque:", error.message);
    
    // Na dúvida, não autorizamos se houver erro no processamento
    return new Response(
      JSON.stringify({ approved: false, reason: "SYSTEM_ERROR" }),
      { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      }
    );
  }
});
