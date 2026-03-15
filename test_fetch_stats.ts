import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetchStats() {
    console.log("Testing fetchStats queries...");

    const { count: deliveriesCount, error: err1 } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_transit');
    console.log('Deliveries:', deliveriesCount, err1);

    const { count: driversCount, error: err2 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
    console.log('Drivers:', driversCount, err2);

    const { data: stores, error: err3 } = await supabase
        .from('stores')
        .select('*');
    console.log('Stores data length:', stores?.length);
    if (stores && stores.length > 0) {
        console.log('Store first record keys:', Object.keys(stores[0]));
        console.log('Store sample:', stores[0]);
    }

    const { data: allDeliveries, error: err4 } = await supabase
        .from('deliveries')
        .select('*');
    console.log('Total deliveries:', allDeliveries?.length);
    if (allDeliveries && allDeliveries.length > 0) {
        console.log('Delivery first record keys:', Object.keys(allDeliveries[0]));
        console.log('Delivery sample:', allDeliveries[0]);
        const delivered = allDeliveries.filter(d => d.status === 'delivered' || d.status === 'completed');
        console.log('Delivered count:', delivered.length);
        const totalValue = delivered.reduce((acc, curr) => acc + (curr.earnings || 0), 0);
        console.log('Total earnings from delivered:', totalValue);
    }
}

testFetchStats();
