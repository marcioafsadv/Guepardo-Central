
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);



import * as fs from 'fs';

async function verify() {
    let output = '';
    output += '--- Deliveries Status Counts ---\n';
    const { data: deliveries, error: delError } = await supabase.from('deliveries').select('driver_id, status, accepted_at');
    if (delError) {
        output += `Deliveries Error: ${delError.message}\n`;
    } else {
        const stats: any = {};
        deliveries.forEach(d => {
            if (!d.driver_id) return;
            if (!stats[d.driver_id]) stats[d.driver_id] = { total: 0, completed: 0, accepted: 0, cancelled: 0 };
            stats[d.driver_id].total++;
            if (d.status === 'delivered' || d.status === 'completed') stats[d.driver_id].completed++;
            if (d.accepted_at) stats[d.driver_id].accepted++;
            if (d.status === 'cancelled') stats[d.driver_id].cancelled++;
        });
        output += `Stats Sample (first 10 drivers):\n${JSON.stringify(Object.entries(stats).slice(0, 10), null, 2)}\n`;
        
        const allStatuses = [...new Set(deliveries.map(d => d.status))];
        output += `Available statuses in deliveries: ${JSON.stringify(allStatuses)}\n`;
    }

    const tablesToCheck = ['delivery_offers', 'delivery_rejections', 'delivery_tracking', 'driver_stats'];
    for (const table of tablesToCheck) {
        output += `\n--- Checking for ${table} ---\n`;
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            output += `${table} table error: ${error.message}\n`;
        } else {
            output += `${table} exists! Columns: ${JSON.stringify(Object.keys(data[0] || {}))}\n`;
        }
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/verify_results.txt', output);
}

verify();
