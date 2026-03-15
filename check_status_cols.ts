import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCols() {
    try {
        const { data: pData } = await supabase.from('profiles').select('*').limit(1);
        fs.writeFileSync('profiles_cols.txt', Object.keys(pData?.[0] || {}).join('\n'));
    } catch (e) {
        console.error(e)
    }
}
checkCols();
