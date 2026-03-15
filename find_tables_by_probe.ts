
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findTables() {
    // Probe common pattern tables directly
    const possibleTables = [
        'delivery_logs', 'delivery_events', 'order_events', 'status_logs',
        'delivery_status_history', 'audit_logs', 'logs', 'events',
        'order_history', 'delivery_history'
    ];
    console.log('Probing tables...');
    for (const table of possibleTables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (!error) {
            console.log(`Found table: ${table}`);
            const { data } = await supabase.from(table).select('*').limit(1);
            if (data && data[0]) console.log('Columns:', Object.keys(data[0]));
        }
    }
}

findTables();
