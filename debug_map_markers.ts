import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMap() {
    console.log('--- STORES ---');
    const { data: stores } = await supabase.from('stores').select('id, fantasy_name, company_name, lat, lng, status');
    console.table(stores);

    console.log('\n--- PROFILES (COURIERS) ---');
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, latitude, longitude, status, role');
    console.table(profiles?.filter(p => p.role === 'courier'));

    console.log('\n--- ACTIVE DELIVERIES ---');
    const { data: deliveries } = await supabase.from('deliveries').select('id, status, courier_id, latitude, longitude');
    console.table(deliveries?.filter(d => ['pending', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery'].includes(d.status)));
}

debugMap();
