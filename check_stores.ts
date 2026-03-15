import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStores() {
    const { data, error } = await supabase
        .from('stores')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching stores:', error);
    } else {
        fs.writeFileSync('stores_data.json', JSON.stringify(data, null, 2));
        console.log('Saved to stores_data.json');
    }
}

checkStores();
