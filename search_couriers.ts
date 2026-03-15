
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function searchCourierTables() {
    let output = '--- Searching for Courier-related tables ---\n';

    const guesses = [
        'couriers', 'courier_profiles', 'courier_documents', 'courier_vehicles', 
        'entregadores', 'entregador_dados', 'veiculos', 'enderecos',
        'registration_data', 'onboarding_data'
    ];
    
    for (const g of guesses) {
        const { error } = await supabase.from(g).select('*').limit(1);
        if (!error) {
            output += `Table "${g}": EXISTS\n`;
            const { data } = await supabase.from(g).select('*').limit(1);
            if (data && data.length > 0) {
                output += `  Columns: ${JSON.stringify(Object.keys(data[0]))}\n`;
            }
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/courier_search_results.txt', output);
}

searchCourierTables();
