import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStores() {
    try {
        const { data: stores, error } = await supabase.from('stores').select('id, fantasy_name, status');
        if (error) throw error;
        console.log("Stores statuses:");
        console.table(stores);
    } catch (e) {
        console.error("Error:", e);
    }
}
checkStores();
