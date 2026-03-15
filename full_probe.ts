
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function findRealTables() {
    let output = '--- Full Database Probe ---\n';

    const candidates = [
        'profiles', 'perfis', 'entregadores', 'drivers', 'couriers',
        'vehicles', 'veiculos', 'veículos', 'frota',
        'addresses', 'enderecos', 'endereços', 'localizacoes',
        'deliveries', 'entregas', 'pedidos',
        'stores', 'lojas', 'estabelecimentos',
        'messages', 'mensagens', 'conversas'
    ];

    for (const c of candidates) {
        const { count, error } = await supabase.from(c).select('*', { count: 'exact', head: true });
        if (!error) {
            output += `Table "${c}": ${count} records\n`;
            if (count && count > 0) {
                 const { data } = await supabase.from(c).select('*').limit(1);
                 output += `  Columns: ${JSON.stringify(Object.keys(data?.[0] || {}))}\n`;
            }
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/full_probe.txt', output);
    console.log('Results written to full_probe.txt');
}

findRealTables();
