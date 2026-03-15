
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkFullNameColumn() {
    console.log('--- Checking for full_name column ---');

    const { data: v, error: vErr } = await supabase.from('vehicles').select('*').limit(1);
    const { data: a, error: aErr } = await supabase.from('addresses').select('*').limit(1);

    if (vErr) {
        console.error('Error fetching vehicles:', vErr);
    } else if (v && v.length > 0) {
        console.log('Vehicle sample keys:', Object.keys(v[0]));
        if ('full_name' in v[0]) {
            console.log('COLUMN "full_name" EXISTS IN "vehicles"');
        } else {
            console.log('COLUMN "full_name" DOES NOT EXIST IN "vehicles"');
        }
    } else {
        console.log('No data in vehicles table to check columns.');
    }

    if (aErr) {
        console.error('Error fetching addresses:', aErr);
    } else if (a && a.length > 0) {
        console.log('Address sample keys:', Object.keys(a[0]));
        if ('full_name' in a[0]) {
            console.log('COLUMN "full_name" EXISTS IN "addresses"');
        } else {
            console.log('COLUMN "full_name" DOES NOT EXIST IN "addresses"');
        }
    } else {
        console.log('No data in addresses table to check columns.');
    }
}

checkFullNameColumn();
