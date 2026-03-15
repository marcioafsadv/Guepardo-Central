
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function inspectTracking() {
    console.log('--- Inspecting delivery_tracking ---');
    const { data: tracking, error } = await supabase.from('delivery_tracking').select('*').limit(5);
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Columns:', Object.keys(tracking[0] || {}));
        console.log('Sample Data:', JSON.stringify(tracking, null, 2));
    }
}

inspectTracking();
