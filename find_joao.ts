
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function findJoao() {
    let output = '--- Finding Joao Silva Santos (v2) ---\n';

    // Try multiple variations or just match part of the name
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%João Silva Santos%')
        .limit(1);

    if (error) {
        output += `Error: ${error.message}\n`;
    } else if (data && data.length > 0) {
        output += `Found Profile: ${JSON.stringify(data[0], null, 2)}\n`;
    } else {
        output += `Profile "João Silva Santos" NOT FOUND.\n`;
        // Try another search
        const { data: data2 } = await supabase
            .from('profiles')
            .select('*')
            .ilike('full_name', '%Silva Santos%')
            .limit(1);
        output += `Alternative search (Silva Santos): ${JSON.stringify(data2?.[0], null, 2)}\n`;
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/find_joao_results.txt', output);
    console.log('Results written to find_joao_results.txt');
}

findJoao();
