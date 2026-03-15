
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSpecificDrivers() {
    const names = ['João Silva', 'Jessica Souza', 'washington Torres'];

    console.log('--- Checking Specific Drivers ---');

    for (const name of names) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*, addresses(*), vehicles(*)')
            .ilike('full_name', `%${name}%`);

        if (error) {
            console.error(`Error checking ${name}:`, error);
        } else {
            console.log(`Results for "${name}":`);
            data?.forEach(d => {
                console.log(`  - ID: ${d.id}`);
                console.log(`  - NAME: ${d.full_name} | STATUS: ${d.status}`);
                console.log(`    ADDRESSES: ${JSON.stringify(d.addresses)}`);
                console.log(`    VEHICLES: ${JSON.stringify(d.vehicles)}`);
            });
        }
    }
}

checkSpecificDrivers();
