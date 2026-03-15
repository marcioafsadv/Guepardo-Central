
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkStoreCols() {
    const { data, error } = await supabase.from('stores').select('*').limit(1);
    let output = 'Stores columns:\n';
    if (data && data.length > 0) {
        output += JSON.stringify(Object.keys(data[0]), null, 2);
        console.log(output);
    } else {
        output += 'No stores found or error: ' + JSON.stringify(error);
        console.log(output);
    }
    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/store_cols_check.txt', output);
}

checkStoreCols();
