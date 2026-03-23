
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkDeliveries() {
    const { data, error } = await supabase.from('deliveries').select('*').limit(1);
    if (error) {
        console.error('Error deliveries:', error);
    } else if (data && data.length > 0) {
        console.log('Deliveries keys:', Object.keys(data[0]));
    } else {
        console.log('Deliveries table is empty or inaccessible.');
    }
    
    // Check common dependent tables
    const tables = ['withdrawal_requests', 'store_profiles', 'wallet_transactions'];
    for (const t of tables) {
        const { data: d, error: e } = await supabase.from(t).select('*').limit(1);
        if (!e && d && d.length > 0) console.log(`${t} keys:`, Object.keys(d[0]));
        else if (e) console.log(`${t} error:`, e.message);
    }
}

checkDeliveries();
