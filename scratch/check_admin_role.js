
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminStatus() {
    console.log('Checking current user role...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
        console.error('User Error:', userError);
        return;
    }
    
    if (user) {
        console.log('User ID:', user.id);
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
            
        if (profileError) {
            console.error('Profile Error:', profileError);
        } else {
            console.log('Profile Role:', profile.role);
        }
    } else {
        console.log('No user logged in.');
    }
}

checkAdminStatus();
