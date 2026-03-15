
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function directDataCheck() {
    let output = '--- Direct Data Check (No Filters) ---\n';

    const tables = ['vehicles', 'addresses', 'profiles'];
    for (const t of tables) {
        const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(5);
        output += `\nTable: ${t}\n`;
        if (error) {
            output += `  Error: ${error.message}\n`;
        } else {
            output += `  Count (exact): ${count}\n`;
            output += `  Rows returned: ${data?.length}\n`;
            if (data && data.length > 0) {
                output += `  First Row Sample: ${JSON.stringify(data[0])}\n`;
            }
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/direct_data_check.txt', output);
}

directDataCheck();
