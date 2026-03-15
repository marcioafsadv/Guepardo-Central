import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function checkStores() {
    const { data, error } = await supabase.from('stores').select('*').limit(5);
    if (error) {
        console.error('Error:', error);
        return;
    }
    if (data.length > 0) {
        console.log('Columns in stores table:', Object.keys(data[0]));
        data.forEach((row, i) => {
            console.log(`Row ${i + 1}:`, JSON.stringify(row, null, 2));
        });
    } else {
        console.log('No data in stores table.');
    }
}

checkStores();
