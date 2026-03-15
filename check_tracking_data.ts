
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAnyData() {
    const { data, count, error } = await supabase.from('delivery_tracking').select('*', { count: 'exact' });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Total rows in delivery_tracking:', count);
        if (data && data.length > 0) {
            console.log('Sample row:', data[0]);
        }
    }
}

checkAnyData();
