import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase credentials in ENV");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function dumpStores() {
    try {
        const { data: stores, error } = await supabase.from('stores').select('id, fantasy_name, is_active, status');
        if (error) throw error;
        fs.writeFileSync('stores_dump.json', JSON.stringify(stores, null, 2));
        console.log("Dumped stores to stores_dump.json");
    } catch (e) {
        console.error("Error damping stores:", e);
    }
}
dumpStores();
