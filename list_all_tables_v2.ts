
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
    const { data, error } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
    if (error) {
        // Fallback to a common tables probe
        const commonTables = ['profiles', 'deliveries', 'stores', 'vehicles', 'addresses', 'delivery_tracking', 'driver_details'];
        console.log('Direct query failed, probing common tables...');
        for (const t of commonTables) {
            const { error: probeError } = await supabase.from(t).select('id').limit(1);
            if (!probeError) console.log(`Found table: ${t}`);
        }
    } else {
        console.log('Tables:', data.map(t => t.tablename));
    }
}

listTables();
