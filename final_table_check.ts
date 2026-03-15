
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
    console.log('--- Table Check ---');

    // Check Profiles
    const { data: p, error: pe } = await supabase.from('profiles').select('id, full_name');
    console.log('Profiles:', p?.length || 0);

    // Check Vehicles
    const { data: v, error: ve } = await supabase.from('vehicles').select('*');
    console.log('Vehicles:', v?.length || 0);
    if (v && v.length > 0) console.log('Vehicle data:', JSON.stringify(v, null, 2));

    // Check Addresses
    const { data: a, error: ae } = await supabase.from('addresses').select('*');
    console.log('Addresses:', a?.length || 0);

    if (pe) console.error('Profile Error:', pe);
    if (ve) console.error('Vehicle Error:', ve);
    if (ae) console.error('Address Error:', ae);
}

checkTables();
