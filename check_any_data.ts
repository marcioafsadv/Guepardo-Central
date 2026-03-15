
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAnyData() {
    const { data: p } = await supabase.from('profiles').select('id').limit(1);
    const { data: v } = await supabase.from('vehicles').select('id').limit(1);
    const { data: a } = await supabase.from('addresses').select('id').limit(1);

    console.log('--- Data Presence ---');
    console.log('Profiles has data:', !!(p && p.length > 0));
    console.log('Vehicles has data:', !!(v && v.length > 0));
    console.log('Addresses has data:', !!(a && a.length > 0));

    if (v && v.length > 0) {
        const { data: allV } = await supabase.from('vehicles').select('*');
        console.log('Vehicle data:', JSON.stringify(allV, null, 2));
    }
}

checkAnyData();
