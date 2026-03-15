
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    console.log("Checking tables...");
    const tables = ['delivery_tracks', 'location_history', 'tracking', 'locations', 'route_history'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            console.log(`Table ${table}: NOT FOUND (${error.message})`);
        } else {
            console.log(`Table ${table}: FOUND!`);
        }
    }
}

check();
