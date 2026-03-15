
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectTables() {
    const tables = ['profiles', 'addresses', 'vehicles', 'driver_licenses'];

    for (const table of tables) {
        console.log(`\n--- Inspecting Table: ${table} ---`);
        const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).limit(3);

        if (error) {
            console.error(`Error in ${table}:`, error.message);
        } else {
            console.log(`Table exists. Count: ${count}`);
            console.log('Sample Data:');
            console.log(JSON.stringify(data, null, 2));
        }
    }
}

inspectTables();
