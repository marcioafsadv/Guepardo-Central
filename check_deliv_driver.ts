
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkDeliveriesForDriver() {
    let output = '--- Checking Deliveries for Driver Info ---\n';

    const joaoId = "0decb1d7-eca8-4382-83db-c2116dcb3864";
    const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('driver_id', joaoId)
        .limit(10);

    if (error) {
        output += `Error: ${error.message}\n`;
    } else if (deliveries && deliveries.length > 0) {
        output += `Found ${deliveries.length} deliveries.\n`;
        output += `Columns: ${JSON.stringify(Object.keys(deliveries[0]))}\n`;
        deliveries.forEach(d => {
            output += `Delivery ${d.id}: Plate=${d.vehicle_plate}, Type=${d.vehicle_type}, Items=${JSON.stringify(d.items)}\n`;
        });
    } else {
        output += `No deliveries found for this driver ID.\n`;
        // Try courier_id
        const { data: d2 } = await supabase.from('deliveries').select('*').eq('courier_id', joaoId).limit(5);
        output += `Courier_id search: ${d2?.length || 0} found.\n`;
    }

    fs.writeFileSync('c:/Projetos/GUEPARDO-CENTRAL/delivery_driver_search.txt', output);
}

checkDeliveriesForDriver();
