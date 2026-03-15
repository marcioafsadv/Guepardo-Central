
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function inspectOtherTables() {
    let output = '--- Inspecting Vehicles & Addresses ---\n';

    const tables = ['vehicles', 'addresses'];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('*').limit(1);
        if (error) {
            output += `Table "${t}": ERROR - ${error.message}\n`;
        } else {
            output += `Table "${t}": EXISTS\n`;
            if (data && data.length > 0) {
                output += `  Sample Data: ${JSON.stringify(data[0])}\n`;
                output += `  Columns: ${JSON.stringify(Object.keys(data[0]))}\n`;
            } else {
                output += `  Table is EMPTY.\n`;
                // Try to get columns even if empty by selecting a non-existent column to trigger error
                const { error: colError } = await supabase.from(t).select('non_existent_column');
                if (colError) {
                    output += `  Col probe error: ${colError.message}\n`;
                }
            }
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/table_inspection_v2.txt', output);
}

inspectOtherTables();
