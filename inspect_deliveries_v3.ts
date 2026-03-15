
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDeliveries() {
    console.log('--- Inspecting Deliveries Table ---');
    const { data: deliveries, error } = await supabase.from('deliveries').select('*').limit(1);
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Deliveries Columns:', Object.keys(deliveries[0] || {}));
        console.log('Sample Delivery Data:', JSON.stringify(deliveries[0], null, 2));
    }

    console.log('\n--- Checking for Status History Table ---');
    // Try common names
    const historyTables = ['delivery_status_history', 'order_status_history', 'status_history', 'delivery_logs'];
    for (const table of historyTables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            console.log(`Found history table: ${table}`);
            console.log('Columns:', Object.keys(data[0] || {}));
            break;
        }
    }
}

inspectDeliveries();
