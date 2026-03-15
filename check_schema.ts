import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('Checking deliveries table schema...');
    const { data: delData, error: delError } = await supabase
        .from('deliveries')
        .select('*')
        .limit(1);
    
    if (delError) {
        console.error('Error fetching deliveries:', delError);
    } else {
        console.log('Deliveries sample:', delData);
        if (delData && delData.length > 0) {
            console.log('Type of id:', typeof delData[0].id);
        }
    }

    console.log('\nChecking profiles table schema...');
    const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
    
    if (profError) {
        console.error('Error fetching profiles:', profError);
    } else {
        console.log('Profiles sample:', profData);
        if (profData && profData.length > 0) {
            console.log('Type of profile id:', typeof profData[0].id);
            // Also check if matches UUID pattern
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            console.log('Is valid UUID string:', uuidPattern.test(profData[0].id));
        }
    }
}

checkSchema();
