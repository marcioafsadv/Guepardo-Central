
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectVehicles() {
    const { data, error } = await supabase.from('vehicles').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('Vehicle columns:', Object.keys(data[0]));
        console.log('Sample vehicle:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No vehicles found');
    }
}

inspectVehicles();
