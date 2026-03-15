
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAllProfiles() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('--- Profiles found:', data.length, '---');
        data.forEach(p => console.log(`- name: ${p.full_name}, status: ${p.status}, role: ${p.role}`));
    }
}

checkAllProfiles();
