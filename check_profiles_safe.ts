
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkProfiles() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, status, vehicle_type');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Total Profiles:', profiles.length);
    console.log('Sample profiles:', profiles.slice(0, 5));
    
    const statuses = [...new Set(profiles.map(p => p.status))];
    const vehicleTypes = [...new Set(profiles.map(p => p.vehicle_type))];
    
    console.log('Unique statuses:', statuses);
    console.log('Unique vehicle_types:', vehicleTypes);
}

checkProfiles();
