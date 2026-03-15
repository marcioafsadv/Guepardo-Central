
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function findAllTables() {
    let output = '--- Finding All Tables ---\n';

    // This might fail if the user doesn't have permissions, but worth a try
    // We can use a trick: try to call a function that lists tables or use the REST API to explore
    
    // Actually, Supabase's PostgREST might not allow direct schema inspection easily without RPC.
    // Let's try to query 'information_schema.tables' via .from() which usually fails.
    const { error: e1 } = await supabase.from('information_schema.tables').select('*').limit(1);
    if (e1) output += `info_schema probe error: ${e1.message}\n`;

    // Let's try to list files in the 'courier-documents' bucket.
    // This might give a hint about the data structure.
    const { data: files, error: fError } = await supabase.storage.from('courier-documents').list('0decb1d7-eca8-4382-83db-c2116dcb3864');
    if (!fError) {
        output += `Files for Joao: ${JSON.stringify(files.map(f => f.name))}\n`;
    } else {
        output += `Storage Error: ${fError.message}\n`;
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/table_and_file_results.txt', output);
}

findAllTables();
