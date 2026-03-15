
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeTables() {
    const tableNames = ['messages', 'chats', 'conversations', 'chat_messages', 'order_chats', 'stores', 'deliveries', 'profiles'];
    console.log('--- Probing tables ---');
    
    for (const name of tableNames) {
        const { data, error } = await supabase.from(name).select('*').limit(1);
        if (error) {
            console.log(`Table '${name}': Error or Missing (${error.message})`);
        } else {
            console.log(`Table '${name}': EXISTS`);
        }
    }
}

probeTables();
