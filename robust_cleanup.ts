
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const profiles = JSON.parse(fs.readFileSync('c:/Projetos/GUEPARDO-CENTRAL/profiles_dump.json', 'utf8'));
const ids = profiles.map((p: any) => p.id);

async function attemptDelete() {
    console.log('Attempting cleanup of', ids.length, 'profiles...');

    for (const id of ids) {
        // Try deleting from tables without checking if they exist (just catch error)
        try {
            const { error: e1 } = await supabase.from('vehicles').delete().eq('user_id', id);
            if (e1) console.log(`  Vehicles (${id}): ${e1.message}`);
            
            const { error: e2 } = await supabase.from('addresses').delete().eq('user_id', id);
            if (e2) console.log(`  Addresses (${id}): ${e2.message}`);
            
            const { error: e3 } = await supabase.from('deliveries').delete().eq('driver_id', id);
            if (e3) console.log(`  Deliveries (${id}): ${e3.message}`);

            const { error: e4 } = await supabase.from('profiles').delete().eq('id', id);
            if (e4) {
                console.log(`  Profile (${id}) FAILED: ${e4.message} (${e4.code})`);
            } else {
                console.log(`  Profile (${id}) deleted.`);
            }
        } catch (err: any) {
            console.log(`  Unexpected error for ${id}: ${err.message}`);
        }
    }
}

attemptDelete();
