
import { createClient } from '@supabase/supabase-js';

import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectProfiles() {
    console.log('--- Detailed Profile Inspection ---');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (profiles && profiles.length > 0) {
        console.log(`Total Profiles: ${profiles.length}`);
        console.log('Columns:', Object.keys(profiles[0]));

        profiles.forEach(p => {
            console.log(`\nDriver: ${p.full_name} (${p.id})`);
            // List all non-null values to find hidden data
            Object.entries(p).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    console.log(`  ${key}: ${JSON.stringify(value)}`);
                }
            });
        });
    } else {
        console.log('No profiles found.');
    }
}

inspectProfiles();
