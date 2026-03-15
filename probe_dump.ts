
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function directProbe() {
    let output = '--- Direct Probe with Full Content ---\n';

    const testJoao = "0decb1d7-eca8-4382-83db-c2116dcb3864";

    const { data: addr, error: e1 } = await supabase.from('addresses').select('*').eq('user_id', testJoao).maybeSingle();
    output += `Address Query for João: ${JSON.stringify(addr)}\n`;
    output += `Address Error: ${e1?.message || 'none'}\n\n`;

    const { data: veh, error: e2 } = await supabase.from('vehicles').select('*').eq('user_id', testJoao).maybeSingle();
    output += `Vehicle Query for João: ${JSON.stringify(veh)}\n`;
    output += `Vehicle Error: ${e2?.message || 'none'}\n\n`;

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/direct_probe_dump.txt', output);
}

directProbe();
