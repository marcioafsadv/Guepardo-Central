
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function searchPlate() {
    const plate = 'HEZ-6664';
    console.log(`Searching for ${plate}...`);
    
    // Search in profiles
    const { data: profs } = await supabase.from('profiles').select('*');
    profs?.forEach(p => {
        if (JSON.stringify(p).includes(plate)) {
            console.log(`Found in profiles: ${p.id}`);
            console.log('Columns containing plate:', Object.keys(p).filter(k => String(p[k]).includes(plate)));
        }
    });

    // Search in vehicles
    const { data: vehs } = await supabase.from('vehicles').select('*');
    vehs?.forEach(v => {
        if (JSON.stringify(v).includes(plate)) {
            console.log(`Found in vehicles: ${v.id}`);
            console.log('Columns containing plate:', Object.keys(v).filter(k => String(v[k]).includes(plate)));
        }
    });
}

searchPlate();
