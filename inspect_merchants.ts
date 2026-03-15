import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function checkMerchantProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'merchant').limit(5);
    if (error) {
        console.error('Error:', error);
        return;
    }
    if (data.length > 0) {
        data.forEach((row, i) => {
            console.log(`Merchant ${i + 1}:`, JSON.stringify(row, null, 2));
        });
    } else {
        console.log('No merchants found in profiles.');
    }
}

checkMerchantProfiles();
