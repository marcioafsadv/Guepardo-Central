
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function debugSchemaCache() {
    let output = '--- Schema Cache Debug ---\n';

    const test = async (tableName: string) => {
        const { data, error, status, statusText } = await supabase.from(tableName).select('*').limit(1);
        output += `Querying "${tableName}":\n`;
        output += `  Status: ${status} (${statusText})\n`;
        if (error) {
            output += `  Error Code: ${error.code}\n`;
            output += `  Message: ${error.message}\n`;
            output += `  Hint: ${error.hint}\n`;
        } else {
            output += `  Success! Rows: ${data?.length}\n`;
        }
        output += '\n';
    };

    await test('veículos');
    await test('"veículos"');
    await test('public.veículos');
    await test('veiculos');
    await test('vehicles');
    await test('perfis');
    await test('profiles');

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/schema_debug.txt', output);
}

debugSchemaCache();
