import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStores() {
    try {
        const { data: stores } = await supabase.from('stores').select('*');
        const storeOwnersIds = stores?.map(s => s.id) || [];

        const { data: profiles } = await supabase.from('profiles').select('id, full_name, is_online, status').in('id', storeOwnersIds);
        fs.writeFileSync('store_owners_profiles.json', JSON.stringify(profiles, null, 2));
    } catch (e) {
        console.error(e)
    }
}
checkStores();
