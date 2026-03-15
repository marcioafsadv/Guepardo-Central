
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkTables() {
    let output = '--- Table Verification ---\n';

    const tablesToCheck = ['vehicles', 'addresses', 'driver_vehicles', 'driver_addresses', 'courier_vehicles', 'courier_addresses'];
    
    for (const table of tablesToCheck) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            output += `Table "${table}": NOT FOUND or ERROR: ${error.message}\n`;
        } else {
            output += `Table "${table}": EXISTS\n`;
            if (data && data.length > 0) {
                output += `  Columns: ${JSON.stringify(Object.keys(data[0]))}\n`;
                output += `  Sample Row: ${JSON.stringify(data[0])}\n`;
            } else {
                output += `  Table is empty.\n`;
            }
        }
    }

    // Also check profiles metadata just in case
    const { data: profile, error: pError } = await supabase.from('profiles').select('*').limit(1);
    if (!pError && profile && profile.length > 0) {
        output += `\nProfiles Sample Metadata: ${JSON.stringify(profile[0].metadata || 'NONE')}\n`;
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/table_verification_results.txt', output);
    console.log('Results written to table_verification_results.txt');
}

checkTables();
