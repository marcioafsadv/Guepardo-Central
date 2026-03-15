
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectProfiles() {
    console.log('--- Inspecting Profile Columns ---');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (profiles && profiles.length > 0) {
        console.log('Columns found:', Object.keys(profiles[0]));
        console.log('\n--- All Profiles Data ---');
        const { data: allProfiles } = await supabase.from('profiles').select('*');
        console.log(JSON.stringify(allProfiles, null, 2));
    } else {
        console.log('No profiles found.');
    }
}

inspectProfiles();
