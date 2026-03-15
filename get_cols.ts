
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function getCols() {
    let output = '--- Table Column Investigation ---\n';

    const tables = ['vehicles', 'addresses', 'profiles'];
    for (const t of tables) {
        // A trick to get columns via selecting from a non-existent column to see error message 
        // OR just try to get one record and see keys.
        // If empty, we can try to use a dummy insert (but we won't do that).
        // Let's try to query the schema if possible.
        
        const { data, error } = await supabase.from(t).select('*').limit(1);
        output += `Table "${t}":\n`;
        if (data && data.length > 0) {
            output += `  Keys: ${JSON.stringify(Object.keys(data[0]))}\n`;
        } else {
             output += `  Empty table. Trying to find columns via Error...\n`;
             const { error: err } = await supabase.from(t).select('id, *').limit(0);
             // Unfortunately PostgREST usually doesn't reveal columns in errors unless it's a specific column error.
             
             // Try common names
             const common = ['profile_id', 'user_id', 'driver_id', 'courier_id', 'model', 'plate', 'cnh', 'street', 'city'];
             for (const c of common) {
                 const { error: e } = await supabase.from(t).select(c).limit(1);
                 if (!e) output += `  Column "${c}" EXISTS in ${t}\n`;
             }
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/column_discovery.txt', output);
}

getCols();
