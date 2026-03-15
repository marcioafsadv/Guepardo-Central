
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function deepScan() {
    let output = '--- Deep Scan Profiles ---\n';

    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) {
        output += `Error: ${error.message}\n`;
    } else if (profiles) {
        output += `Found ${profiles.length} profiles.\n`;
        const allKeys = new Set<string>();
        profiles.forEach(p => Object.keys(p).forEach(k => allKeys.add(k)));
        output += `All unique columns in profiles: ${JSON.stringify(Array.from(allKeys))}\n`;
        
        profiles.forEach(p => {
            if (p.full_name?.includes('Jessica')) {
                 output += `Jessica Data: ${JSON.stringify(p)}\n`;
            }
        });
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/deep_scan_profiles.txt', output);
}

deepScan();
