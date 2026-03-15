
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkStore() {
    console.log('Checking Torres & Silva data...');
    const { data, error } = await supabase
        .from('stores')
        .select('*')
        .ilike('fantasy_name', '%Torres%');
    
    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        const s = data[0];
        const result = {
            id: s.id,
            fantasy_name: s.fantasy_name,
            company_name: s.company_name,
            cnpj: s.cnpj,
            document: s.document,
            address: s.address,
            onboarding_status: s.onboarding_status,
            document_url: s.document_url,
            contract_url: s.contract_url,
            location_photo_url: s.location_photo_url,
            all_keys: Object.keys(s)
        };
        console.log('Result found:', result);
        fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/torres_data.txt', JSON.stringify(result, null, 2));
    } else {
        console.log('No store found with that name.');
        fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/torres_data.txt', 'NOT FOUND');
    }
}

checkStore();
