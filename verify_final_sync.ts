
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function verifyFinalSync() {
    console.log('--- Verificando Sincronização Final ---');

    console.log('\n1. Verificando Colunas em "vehicles":');
    const { data: v } = await supabase.from('vehicles').select('*').limit(1);
    if (v && v.length > 0) {
        console.log('Colunas:', Object.keys(v[0]));
        console.log('Exemplo Nome:', v[0].full_name || 'PENDENTE (Aplique o SQL)');
    }

    console.log('\n2. Verificando Colunas em "addresses":');
    const { data: a } = await supabase.from('addresses').select('*').limit(1);
    if (a && a.length > 0) {
        console.log('Colunas:', Object.keys(a[0]));
        console.log('Exemplo Nome:', a[0].full_name || 'PENDENTE (Aplique o SQL)');
    }

    console.log('\n3. Verificando Triggers (Indireto):');
    console.log('Se os nomes acima aparecerem como PENDENTE, por favor aplique o script SQL fornecido no terminal.');
}

verifyFinalSync();
