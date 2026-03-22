import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testToggle() {
    const storeId = "1197db1f-036b-4814-9806-41046d84ebdf"; // MAFS ADVOCACIA
    try {
        console.log("Checking current state...");
        const { data: storeBefore } = await supabase.from('stores').select('id, is_active, status').eq('id', storeId).single();
        console.log("Before:", storeBefore);

        const nextActive = !storeBefore.is_active;
        const nextStatus = nextActive ? 'aberta' : 'fechada';

        console.log(`Updating to: is_active=${nextActive}, status=${nextStatus}`);
        const { data, error } = await supabase.from('stores').update({ is_active: nextActive, status: nextStatus }).eq('id', storeId).select();
        
        if (error) {
            console.error("Update failed:", error);
        } else {
            console.log("Update success:", data);
        }

        const { data: storeAfter } = await supabase.from('stores').select('id, is_active, status').eq('id', storeId).single();
        console.log("After:", storeAfter);
    } catch (e) {
        console.error("Test failed:", e);
    }
}
testToggle();
