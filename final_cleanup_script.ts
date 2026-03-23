
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const profiles = JSON.parse(fs.readFileSync('c:/Projetos/GUEPARDO-CENTRAL/profiles_dump.json', 'utf8'));
const ids = profiles.map((p: any) => p.id);

async function finalCleanup() {
    console.log('Final cleanup of all profiles...');

    for (const id of ids) {
        console.log(`Deleting ${id}...`);
        // Deleting from tables we KNOW exist and follow user_id/id pattern
        await supabase.from('vehicles').delete().eq('user_id', id);
        await supabase.from('addresses').delete().eq('user_id', id);
        
        // Try deleting from 'deliveries' where driver_id = id
        await supabase.from('deliveries').delete().eq('driver_id', id).then(r => {
            if (r.error) console.log(`  Deliveries skip/fail for ${id}: ${r.error.message}`);
        });

        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) {
            console.log(`  FAILED deleting profile ${id}: ${error.message}`);
        } else {
            console.log(`  Profile ${id} deleted.`);
        }
    }
}

finalCleanup();
