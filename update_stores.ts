import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

async function updateStoreStatuses() {
    const { data: stores, error: fetchError } = await supabase
        .from('stores')
        .select('id, status');

    if (fetchError) {
        console.error('Error fetching stores:', fetchError);
        return;
    }

    for (const store of stores || []) {
        if (!store.status) {
            const { error: updateError } = await supabase
                .from('stores')
                .update({ status: 'open' })
                .eq('id', store.id);
            if (updateError) {
                console.error(`Error updating store ${store.id}:`, updateError);
            } else {
                console.log(`Store ${store.id} updated to 'open'.`);
            }
        } else {
            console.log(`Store ${store.id} already has status '${store.status}'.`);
        }
    }
}

updateStoreStatuses();
