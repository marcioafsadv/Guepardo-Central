
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listAllProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*');

    if (error) {
        console.error('Error listing profiles:', error);
    } else {
        console.log('--- All Profiles ---');
        data.forEach(p => console.log(`ID: ${p.id} | NAME: ${p.full_name} | STATUS: ${p.status} | ROLE: ${p.role}`));
    }
}

listAllProfiles();
