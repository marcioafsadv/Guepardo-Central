import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStores() {
    try {
        const { data: stores, error } = await supabase.from('stores').select('*').limit(1);
        if (error) throw error;
        fs.writeFileSync('store_cols.json', JSON.stringify(Object.keys(stores[0] || {})));
        console.log("Written to store_cols.json");
    } catch (e) {
        console.error("Error:", e);
    }
}
checkStores();
