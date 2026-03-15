
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listColumns() {
    // We can use an RPC if we have one, or just try to select dynamic columns
    const { data, error } = await supabase.rpc('get_table_columns_sql', { t_name: 'profiles' });
    if (error) {
        console.log('RPC failed, trying fallback...');
        const { data: cols, error: sqlError } = await supabase.from('profiles').select('*').limit(1);
        if (cols && cols.length > 0) {
            console.log('Columns from select *:', Object.keys(cols[0]));
        }
    } else {
        console.log('Columns from RPC:', data);
    }
}

listColumns();
