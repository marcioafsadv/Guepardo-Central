
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function exhaustiveTableCheck() {
    const list = [
        'vehicles', 'veiculos', 'veículos', 
        'addresses', 'enderecos', 'endereços'
    ];
    console.log('--- Exhaustive Table Check ---');
    for (const name of list) {
        try {
            const { data, error } = await supabase.from(name).select('*').limit(1);
            if (error) {
                console.log(`Table "${name}": ERROR - ${error.message} (Code: ${error.code})`);
            } else {
                console.log(`Table "${name}": SUCCESS - Found ${data?.length} sample rows`);
            }
        } catch (e) {
            console.log(`Table "${name}": EXCEPTION - ${e}`);
        }
    }
}

exhaustiveTableCheck();
