
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkPortugueseColumns() {
    let output = '--- Portuguese Column Investigation ---\n';

    const guesses = [
        'modelo_moto', 'placa_moto', 'modelo_veiculo', 'placa_veiculo', 'cnh', 'endereco',
        'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'complemento'
    ];
    
    for (const g of guesses) {
        const { error } = await supabase.from('profiles').select(g).limit(1);
        if (!error) {
            output += `Column "${g}": EXISTS in table "profiles"\n`;
        }
    }

    // Also check for a table called 'entregadores'
    const { error: e2 } = await supabase.from('entregadores').select('*').limit(1);
    if (!e2) output += `Table "entregadores": EXISTS\n`;

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/portuguese_search_results.txt', output);
}

checkPortugueseColumns();
