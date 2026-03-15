
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkPTTables() {
    let output = '--- Checking PT Tables ---\n';

    const tables = ['veículos', 'endereços', 'perfis'];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('*').limit(3);
        if (!error) {
            output += `Table "${t}": EXISTS\n`;
            if (data && data.length > 0) {
                output += `  Columns: ${JSON.stringify(Object.keys(data[0]))}\n`;
                output += `  Sample Data (1st row): ${JSON.stringify(data[0])}\n`;
            } else {
                output += `  Table is EMPTY.\n`;
            }
        } else {
            output += `Table "${t}": NOT FOUND (${error.message})\n`;
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/pt_tables_check.txt', output);
    console.log('Results written to pt_tables_check.txt');
}

checkPTTables();
