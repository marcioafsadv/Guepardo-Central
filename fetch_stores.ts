import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchAllStores() {
    const { data, error } = await supabase
        .from('stores')
        .select('*');

    if (error) {
        console.error('Erro ao buscar lojistas:', error);
    } else if (data) {
        let output = `Encontrados ${data.length} lojistas cadastrados:\n\n`;
        data.forEach(store => {
            output += `- ID: ${store.id}\n`;
            output += `  Nome Fantasia: ${store.fantasy_name || 'N/A'}\n`;
            output += `  Razão Social: ${store.company_name || 'N/A'}\n`;
            output += `  Documento (${store.tipo_pessoa || '?'}): ${store.document || 'N/A'}\n`;
            output += `  Status: ${store.status || 'N/A'}\n`;
            output += `  Saldo: R$ ${store.balance || 0}\n`;
            output += '---\n';
        });
        fs.writeFileSync('stores_output.txt', output);
        console.log('Output written to stores_output.txt');
    }
}

fetchAllStores();
