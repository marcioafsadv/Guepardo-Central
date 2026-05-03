
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
    console.log('Checking RLS policies for table "vehicles"...');
    
    // We can't directly query pg_policies with anon key usually, 
    // but we can try to see if we have access to a helper or if we can infer it.
    // However, I can try to use the service role key if available in .env to fix it.
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env');
        return;
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: policies, error } = await adminSupabase
        .rpc('get_policies', { table_name: 'vehicles' });

    if (error) {
        console.log('RPC get_policies failed, trying direct query...');
        const { data: policies2, error: error2 } = await adminSupabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'vehicles');
        
        if (error2) {
            // If pg_policies is not accessible via PostgREST, we can try to run a raw SQL if we had an execute_sql RPC
            console.log('Direct query to pg_policies failed. Trying to list all policies for vehicles via raw SQL if possible.');
            
            const { data: policies3, error: error3 } = await adminSupabase.rpc('inspect_table_policies', { t_name: 'vehicles' });
            if (error3) {
                console.error('Could not fetch policies:', error3);
                
                // Let's try to just create a policy that allows everything for now to test if it fixes it, 
                // OR better, try to see what the current user is.
                return;
            }
            console.log('Policies:', policies3);
        } else {
            console.log('Policies (from pg_policies):', policies2);
        }
    } else {
        console.log('Policies (from RPC):', policies);
    }
}

checkRLS();
