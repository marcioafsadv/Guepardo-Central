
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listColumns() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'profiles' });
    if (error) {
        // Fallback to direct SQL if RPC doesn't exist
        const { data: cols, error: sqlError } = await supabase.from('profiles').select('*').limit(1);
        if (sqlError) {
            console.error('Error:', sqlError);
        } else if (cols && cols.length > 0) {
            console.log('Columns:', Object.keys(cols[0]));
        }
    } else {
        console.log('Columns:', data);
    }
}

listColumns();
