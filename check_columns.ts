
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkColumns() {
    let output = '--- Column Investigation ---\n';

    // Trying to use RPC if allowed, or just a trick to get column names
    // A trick is to try to select a column that might exist and see if it fails.
    const possibleColumns = ['vehicle_model', 'vehicle_plate', 'cnh_number', 'vehicle_color', 'address', 'metadata'];
    
    for (const col of possibleColumns) {
        const { error } = await supabase.from('profiles').select(col).limit(1);
        if (!error) {
            output += `Column "${col}": EXISTS in table "profiles"\n`;
        } else {
            output += `Column "${col}": ERROR - ${error.message}\n`;
        }
    }

    // Try vehicles and addresses again specifically for Joao
    const joaoId = "0decb1d7-eca8-4382-83db-c2116dcb3864";
    const { data: v } = await supabase.from('vehicles').select('*').eq('user_id', joaoId);
    output += `Vehicles for Joao: ${JSON.stringify(v)}\n`;
    
    const { data: a } = await supabase.from('addresses').select('*').eq('user_id', joaoId);
    output += `Addresses for Joao: ${JSON.stringify(a)}\n`;

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/column_check_results.txt', output);
}

checkColumns();
