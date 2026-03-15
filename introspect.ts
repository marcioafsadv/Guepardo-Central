
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function introspect() {
    let output = '--- UI Logic Introspection ---\n';

    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: vehicles } = await supabase.from('vehicles').select('*');
    const { data: addresses } = await supabase.from('addresses').select('*');

    const joao = profiles?.find(p => p.full_name?.includes('João'));
    if (joao) {
        output += `João Profile ID: "${joao.id}" (length: ${joao.id.length})\n`;
        
        const matchingVehicles = vehicles?.filter(v => v.user_id === joao.id);
        output += `Matching Vehicles: ${matchingVehicles?.length}\n`;
        if (matchingVehicles && matchingVehicles.length > 0) {
            output += `First Matching Vehicle ID: ${matchingVehicles[0].id}\n`;
            output += `Vehicle UserID: "${matchingVehicles[0].user_id}" (length: ${matchingVehicles[0].user_id.length})\n`;
            output += `ID Match Check: ${joao.id === matchingVehicles[0].user_id}\n`;
        }

        const matchingAddresses = addresses?.filter(a => a.user_id === joao.id);
        output += `Matching Addresses: ${matchingAddresses?.length}\n`;
    } else {
        output += `João not found in profiles!\n`;
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/introspection_results.txt', output);
}

introspect();
