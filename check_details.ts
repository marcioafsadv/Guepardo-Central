
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDriverDetails() {
    console.log('--- Listing All Profiles ---');
    const { data: allProfiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) {
        console.error('Error fetching profiles:', pError.message);
        return;
    }

    console.log(`Found ${allProfiles?.length || 0} profiles.`);

    for (const profile of allProfiles || []) {
        console.log(`\n--- Profile: ${profile.full_name} (${profile.id}) ---`);
        console.log(`Status: ${profile.status}`);

        const { data: addr, error: aError } = await supabase.from('addresses').select('*').eq('user_id', profile.id);
        if (aError) console.log(`Address Error: ${aError.message}`);
        else console.log(`Addresses: ${addr?.length || 0}`);

        const { data: veh, error: vError } = await supabase.from('vehicles').select('*').eq('user_id', profile.id);
        if (vError) console.log(`Vehicle Error: ${vError.message}`);
        else console.log(`Vehicles: ${veh?.length || 0}`);

        if (veh && veh.length > 0) {
            console.log('Vehicle Doc URLs:');
            console.log(`- CNH Front: ${veh[0].cnh_front_url}`);
            console.log(`- CNH Back: ${veh[0].cnh_back_url}`);
            console.log(`- CRLV: ${veh[0].crlv_url}`);
            console.log(`- Bike: ${veh[0].bike_photo_url}`);
        }
    }
}

checkDriverDetails();
