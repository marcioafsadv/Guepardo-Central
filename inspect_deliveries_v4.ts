
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDeliveries() {
    let output = '';
    output += '--- Inspecting Deliveries Table ---\n';
    const { data: deliveries, error } = await supabase.from('deliveries').select('*').limit(2);
    if (error) {
        output += `Error: ${error.message}\n`;
    } else {
        output += `Deliveries Columns: ${JSON.stringify(Object.keys(deliveries[0] || {}))}\n`;
        output += `Sample Delivery Data: ${JSON.stringify(deliveries[0], null, 2)}\n`;
    }

    output += '\n--- Finding Related Tables ---\n';
    const commonTables = ['delivery_status_history', 'order_status_history', 'status_history', 'delivery_logs', 'delivery_events'];
    for (const table of commonTables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            output += `Found table: ${table}\n`;
            output += `Columns: ${JSON.stringify(Object.keys(data[0] || {}))}\n`;
            if (data[0]) {
                 const { data: samples } = await supabase.from(table).select('*').limit(3);
                 output += `Sample data: ${JSON.stringify(samples, null, 2)}\n`;
            }
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/inspection_results.txt', output);
    console.log('Results written to inspection_results.txt');
}

inspectDeliveries();
