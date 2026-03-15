
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function overview() {
    let output = '--- Full Table List ---\n';

    // The best way to get all tables when RPC is missing is via raw SQL if possible, 
    // but the JS client doesn't support raw SQL easily unless we have an RPC for it.
    // Let's try to query a table that definitely exists and check if we can see others.
    
    // Actually, let's try to list all tables through a known RPC or a specific query.
    // If we can't do that, we'll try to guess more names.
    const moreGuess = ['delivery_offers', 'delivery_rejections', 'assignment_history', 'driver_rejections', 'rejeicoes', 'ofertas'];
    for (const g of moreGuess) {
        const { error } = await supabase.from(g).select('id').limit(1);
        if (!error) output += `Table ${g}: EXISTS\n`;
        else output += `Table ${g}: NOT FOUND (${error.message})\n`;
    }

    // Check columns of deliveries for any hint
    const { data: cols } = await supabase.from('deliveries').select('*').limit(1);
    output += `Deliveries Columns: ${JSON.stringify(Object.keys(cols?.[0] || {}))}\n`;

    // Check profiles columns
    const { data: pCols } = await supabase.from('profiles').select('*').limit(1);
    output += `Profiles Columns: ${JSON.stringify(Object.keys(pCols?.[0] || {}))}\n`;

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/db_overview_results.txt', output);
}

overview();
