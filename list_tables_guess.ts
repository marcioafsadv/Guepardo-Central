import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function listTables() {
    const { data, error } = await supabase.rpc('get_tables'); // Hope this RPC exists or I can use another way
    if (error) {
        // If RPC fails, try a simple query to information_schema if possible, or just guess common names
        console.error('RPC Error:', error);
        
        // Alternative: try to select from a few likely candidates
        const candidates = ['store_documents', 'merchant_documents', 'onboarding', 'contracts', 'store_photos'];
        for (const table of candidates) {
            const { error: tableError } = await supabase.from(table).select('count').limit(1);
            if (!tableError) {
                console.log(`Table exists: ${table}`);
            } else {
                console.log(`Table does not exist or error: ${table}`, tableError.message);
            }
        }
        return;
    }
    console.log('Tables:', data);
}

listTables();
