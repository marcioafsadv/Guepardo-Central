
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const profiles = JSON.parse(fs.readFileSync('c:/Projetos/GUEPARDO-CENTRAL/profiles_dump.json', 'utf8'));
const ids = profiles.map((p: any) => p.id);

async function cleanupData() {
    console.log('Cleaning up data for', ids.length, 'profiles...');

    // 1. Vehicles
    const { error: vehErr } = await supabase.from('vehicles').delete().in('user_id', ids);
    if (vehErr) console.error('Error deleting vehicles:', vehErr);
    else console.log('Vehicles deleted.');

    // 2. Addresses
    const { error: addrErr } = await supabase.from('addresses').delete().in('user_id', ids);
    if (addrErr) console.error('Error deleting addresses:', addrErr);
    else console.log('Addresses deleted.');

    // 3. Deliveries (as driver)
    const { error: delErr } = await supabase.from('deliveries').delete().in('driver_id', ids);
    if (delErr) console.error('Error deleting deliveries:', delErr);
    else console.log('Deliveries deleted.');

    // 4. Withdrawal Requests
    const { error: withErr } = await supabase.from('withdrawal_requests').delete().in('driver_id', ids);
    if (withErr) console.error('Error deleting withdrawal_requests:', withErr);
    else console.log('Withdrawal requests deleted.');

    // 5. Finally, Profiles
    const { error: profErr } = await supabase.from('profiles').delete().in('id', ids);
    if (profErr) console.error('Error deleting profiles:', profErr);
    else console.log('Profiles deleted.');
}

cleanupData();
