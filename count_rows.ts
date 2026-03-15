
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCounts() {
    const { count: p } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: v } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
    const { count: a } = await supabase.from('addresses').select('*', { count: 'exact', head: true });

    console.log(`Profiles: ${p}`);
    console.log(`Vehicles: ${v}`);
    console.log(`Addresses: ${a}`);
}

checkCounts();
