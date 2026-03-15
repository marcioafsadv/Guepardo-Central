
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function probeDeep() {
    let output = '--- Deep Schema Probe ---\n';

    // Try to list schemas via a raw query if possible (using rpc if available)
    // Since we don't have rpc, let's try to guess common table names in other schemas or just try to find ANY data.
    
    // Check if there's any data in 'profiles' that has vehicle info in a string field
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(20);
    if (!pError && profiles) {
        output += `Found ${profiles.length} profiles.\n`;
        profiles.forEach(p => {
             if (p.full_name?.includes('João')) {
                 output += `João Data: ${JSON.stringify(p)}\n`;
             }
        });
    }

    // List ALL tables we can find in the public schema specifically
    // We can try to use the 'info' view if it's exposed?
    // Actually, let's just try to query some likely names.
    const guesses = ['couriers', 'drivers', 'vehicle_details', 'address_details', 'registrations'];
    for (const g of guesses) {
        const { error } = await supabase.from(g).select('*').limit(1);
        if (!error) output += `Table "${g}": EXISTS\n`;
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/deep_probe_results.txt', output);
}

probeDeep();
