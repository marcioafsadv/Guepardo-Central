import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectTriggers() {
    try {
        console.log("Attempting to fetch table details...");
        const { data, error } = await supabase
            .from('stores')
            .select('*')
            .limit(1);
            
        if (error) {
            console.error("Error fetching stores:", error);
            return;
        }
        
        console.log("Successfully fetched 1 store. Table exists and is readable.");
        
        console.log("Testing update on non-existent ID...");
        const { data: nonExistent, error: err2 } = await supabase
            .from('stores')
            .update({ status: 'test' })
            .eq('id', '00000000-0000-0000-0000-000000000000')
            .select();
        
        console.log("Non-existent update result:", nonExistent, err2);

        const storeId = "26de04b4-6214-4cbb-9a8f-0cbb8b079761"; // Pilar 4
        console.log(`Testing REAL update on ID: ${storeId}...`);
        const { data: realUpdate, error: err3 } = await supabase
            .from('stores')
            .update({ status: 'fechada' })
            .eq('id', storeId)
            .select();
        
        console.log("Real update result:", realUpdate, err3);

    } catch (e) {
        console.error("Inspection failed:", e);
    }
}
inspectTriggers();
