
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const profiles = JSON.parse(fs.readFileSync('c:/Projetos/GUEPARDO-CENTRAL/profiles_dump.json', 'utf8'));
const targetId = profiles[0].id; // Try to delete the first one

async function debugDelete() {
    console.log('Testing deletion for profile ID:', targetId);

    // Try deleting from vehicles and addresses first
    await supabase.from('vehicles').delete().eq('user_id', targetId);
    await supabase.from('addresses').delete().eq('user_id', targetId);
    
    // Now try profiles
    const { error } = await supabase.from('profiles').delete().eq('id', targetId);
    
    if (error) {
        console.log('--- ERROR DELETING PROFILE ---');
        console.log('Code:', error.code);
        console.log('Message:', error.message);
        console.log('Details:', error.details);
        console.log('Hint:', error.hint);
    } else {
        console.log('Profile successfully deleted.');
    }
}

debugDelete();
