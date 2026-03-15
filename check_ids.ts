
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkIds() {
    let output = '--- Profile ID Check ---\n';

    const { data: profiles } = await supabase.from('profiles').select('id, full_name, name');
    output += `Profiles found: ${profiles?.length}\n`;
    profiles?.forEach(p => {
        output += `Profile: "${p.full_name || p.name}" ID: ${p.id}\n`;
    });

    const { data: vehicles } = await supabase.from('vehicles').select('user_id, model, plate');
    output += `\nVehicles found: ${vehicles?.length}\n`;
    vehicles?.forEach(v => {
        output += `Vehicle: ${v.model} (${v.plate}) UserID: ${v.user_id}\n`;
    });

    const { data: addresses } = await supabase.from('addresses').select('user_id, street');
    output += `\nAddresses found: ${addresses?.length}\n`;
    addresses?.forEach(a => {
        output += `Address: ${a.street} UserID: ${a.user_id}\n`;
    });

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/id_correlation.txt', output);
}

checkIds();
