
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function robustProbe() {
    let output = '--- Robust Column Probe ---\n';

    const tables = ['vehicles', 'addresses', 'profiles'];
    const guesses = [
        'user_id', 'profile_id', 'driver_id',
        'model', 'modelo', 'vehicle_model', 'modelo_veiculo',
        'plate', 'placa', 'vehicle_plate', 'placa_veiculo',
        'cnh', 'cnh_number', 'numero_cnh',
        'street', 'rua', 'logradouro',
        'city', 'cidade', 'municipio',
        'neighborhood', 'bairro', 'distrito',
        'state', 'estado', 'uf',
        'zip', 'cep', 'postal_code',
        'number', 'numero'
    ];

    for (const t of tables) {
        output += `\nTable: ${t}\n`;
        for (const g of guesses) {
            const { error } = await supabase.from(t).select(g).limit(0);
            if (!error) {
                output += `  [Found] ${g}\n`;
            }
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/robust_probe_results.txt', output);
}

robustProbe();
