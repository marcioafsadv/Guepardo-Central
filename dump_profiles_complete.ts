
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function dumpProfiles() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/profiles_dump.json', JSON.stringify(profiles, null, 2));
    console.log('Dumped', profiles.length, 'profiles to profiles_dump.json');
}

dumpProfiles();
