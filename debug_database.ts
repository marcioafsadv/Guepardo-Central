
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugData() {
    console.log('--- Database Debug ---');

    const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: vehicleCount } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
    const { count: addressCount } = await supabase.from('addresses').select('*', { count: 'exact', head: true });

    console.log(`Profiles: ${profileCount}`);
    console.log(`Vehicles: ${vehicleCount}`);
    console.log(`Addresses: ${addressCount}`);

    console.log('\n--- Sample Vehicles ---');
    const { data: vehicles } = await supabase.from('vehicles').select('*').limit(3);
    console.log(JSON.stringify(vehicles, null, 2));

    console.log('\n--- Sample Profiles with Joins ---');
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, vehicles(*)')
        .limit(3);
    console.log(JSON.stringify(profiles, null, 2));
}

debugData();
