import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDeliveries() {
    const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching deliveries:', error);
    } else {
        console.log('Deliveries columns:', Object.keys(data[0] || {}));
    }
}

checkDeliveries();
