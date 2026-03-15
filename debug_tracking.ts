
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTrackingTables() {
    console.log("Checking for tracking related tables...");

    // Check if delivery_tracks exists by trying to select from it
    const { data, error } = await supabase
        .from('delivery_tracks')
        .select('*')
        .limit(1);

    if (error) {
        console.log("Table 'delivery_tracks' does not exist or error:", error.message);
    } else {
        console.log("Table 'delivery_tracks' FOUND!");
        console.log("Sample:", data);
    }

    const { data: data2, error: error2 } = await supabase
        .from('location_history')
        .select('*')
        .limit(1);

    if (error2) {
        console.log("Table 'location_history' does not exist or error:", error2.message);
    } else {
        console.log("Table 'location_history' FOUND!");
        console.log("Sample:", data2);
    }
}

checkTrackingTables();
